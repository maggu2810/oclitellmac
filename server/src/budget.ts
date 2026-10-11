import type { KeyInfoResponse, LiteLLMClient } from "./fetch"
import type { StateManager } from "./state"

export interface BudgetTrackerOptions {
  now?: () => number
  /** Minimum time between two refreshes of the same provider triggered by requests. */
  throttleMs?: number
  /** A provider counts as in use for this long after its last request. */
  activeWindowMs?: number
  /** Idle providers are polled every `idleFactor` poll intervals. */
  idleFactor?: number
}

interface Tracked {
  name: string
  client: LiteLLMClient
  lastFetchAt: number
  lastUsedAt: number | undefined
  inFlight: boolean
}

/** Projection of `/key/info` onto the fields the TUI reads. */
export function pickBudgetFields(keyInfo: KeyInfoResponse): { info: Record<string, unknown> } {
  const info = keyInfo.info ?? {}
  return {
    info: {
      key_alias: info.key_alias,
      spend: info.spend,
      max_budget: info.max_budget,
      budget_duration: info.budget_duration,
      budget_reset_at: info.budget_reset_at,
      expires: info.expires,
    },
  }
}

/**
 * Budget tracker: one timer polls the providers (recently used ones every
 * interval, idle ones every `idleFactor` intervals); requests refresh only
 * the provider being used.
 */
export class BudgetTracker {
  private providers = new Map<string, Tracked>()
  private timer: NodeJS.Timeout | undefined
  private now: () => number
  private throttleMs: number
  private activeWindowMs: number
  private idleFactor: number

  constructor(
    private stateManager: StateManager,
    private pollInterval: number,
    private log: (message: string) => void,
    private logUpdates = false,
    options: BudgetTrackerOptions = {},
  ) {
    this.now = options.now ?? Date.now
    this.throttleMs = options.throttleMs ?? 10_000
    this.activeWindowMs = options.activeWindowMs ?? 30 * 60_000
    this.idleFactor = options.idleFactor ?? 10
  }

  get running(): boolean {
    return this.timer !== undefined
  }

  /**
   * Fetch and store budget data for a provider
   */
  async fetchAndStore(providerKey: string, providerName: string, client: LiteLLMClient): Promise<void> {
    try {
      const keyInfo = await client.fetchKeyInfo()

      await this.stateManager.saveBudgetData(providerKey, {
        providerKey,
        providerName,
        fetchedAt: this.now(),
        keyInfo: pickBudgetFields(keyInfo),
      })

      if (this.logUpdates) this.log(`Budget data updated for ${providerKey}`)
    } catch (error) {
      this.log(`Failed to fetch budget for ${providerKey}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async fetchTracked(providerKey: string, tracked: Tracked): Promise<void> {
    if (tracked.inFlight) return
    tracked.inFlight = true
    tracked.lastFetchAt = this.now()
    try {
      await this.fetchAndStore(providerKey, tracked.name, tracked.client)
    } finally {
      tracked.inFlight = false
    }
  }

  /**
   * Mark a provider as in use and refresh its budget unless it was fetched within the throttle window.
   * Returns whether a fetch was started.
   */
  async refreshForRequest(providerKey: string): Promise<boolean> {
    const tracked = this.providers.get(providerKey)
    if (!tracked) return false
    const now = this.now()
    tracked.lastUsedAt = now
    if (tracked.inFlight || now - tracked.lastFetchAt < this.throttleMs) return false
    await this.fetchTracked(providerKey, tracked)
    return true
  }

  /**
   * Start tracking a provider (initial fetch now, then polling)
   */
  startTracking(providerKey: string, providerName: string, client: LiteLLMClient): void {
    if (this.providers.has(providerKey)) {
      this.log(`Budget tracking already active for ${providerKey}`)
      return
    }

    const tracked: Tracked = {
      name: providerName,
      client,
      lastFetchAt: this.now(),
      lastUsedAt: undefined,
      inFlight: false,
    }
    this.providers.set(providerKey, tracked)
    this.fetchTracked(providerKey, tracked).catch(() => {})

    this.timer ??= setInterval(() => this.tick(), this.pollInterval * 1000)
    this.log(`Started budget tracking for ${providerKey} (interval: ${this.pollInterval}s)`)
  }

  /**
   * Poll every provider that is due. Called by the timer once per poll interval.
   */
  tick(): void {
    const now = this.now()
    const intervalMs = this.pollInterval * 1000
    for (const [providerKey, tracked] of this.providers) {
      const active = tracked.lastUsedAt !== undefined && now - tracked.lastUsedAt <= this.activeWindowMs
      const dueMs = active ? intervalMs : intervalMs * this.idleFactor
      // Half a tick of tolerance so timer jitter does not skip a round.
      if (now - tracked.lastFetchAt >= dueMs - intervalMs / 2) {
        this.fetchTracked(providerKey, tracked).catch(() => {})
      }
    }
  }

  /**
   * Stop tracking for a specific provider
   */
  stopTracking(providerKey: string): void {
    if (!this.providers.delete(providerKey)) return
    if (this.providers.size === 0) this.clearTimer()
    this.log(`Stopped budget tracking for ${providerKey}`)
  }

  /**
   * Stop all tracking
   */
  stopAll(): void {
    for (const key of [...this.providers.keys()]) {
      this.stopTracking(key)
    }
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }
}
