import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { getBudgetDataDir } from './paths'
import type { KeyInfoFile, ProviderBudget, BudgetData } from './types'
import type { Logger } from './log'

export interface LoadResult {
  budgets: BudgetData
  hasErrors: boolean
  errorCount: number
}

/**
 * Budget data loader - reads budget files from ~/.local/state/oclitellmac/key-info/
 */
export class BudgetLoader {
  private budgetDataDir: string
  private logger: Logger
  // Last invalid-file message per provider, so unchanged bad files are logged once
  private lastErrors = new Map<string, string>()

  constructor(logger: Logger, budgetDataDir: string = getBudgetDataDir()) {
    this.logger = logger
    this.budgetDataDir = budgetDataDir
  }

  /**
   * Get the budget data directory path
   */
  getBudgetDataDir(): string {
    return this.budgetDataDir
  }

  /**
   * Load all budget files from key-info directory
   * Files are read concurrently; budgets are ordered by provider name, then key.
   */
  async loadAll(): Promise<LoadResult> {
    this.logger.log('debug', `loadAll: starting, budgetDataDir=${this.budgetDataDir}`)
    let files: string[]

    try {
      files = await readdir(this.budgetDataDir)
    } catch {
      this.logger.log('debug', 'Budget directory not found - waiting for server plugin')
      this.lastErrors.clear()
      return { budgets: {}, hasErrors: false, errorCount: 0 }
    }

    const keys = files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length))
    const loaded = await Promise.all(keys.map(async (key) => [key, await this.loadOne(key)] as const))

    for (const known of [...this.lastErrors.keys()]) {
      if (!keys.includes(known)) this.lastErrors.delete(known)
    }

    const found: ProviderBudget[] = []
    let errorCount = 0
    for (const [, budget] of loaded) {
      if (budget) found.push(budget)
      else errorCount++
    }
    found.sort(
      (a, b) => a.providerName.localeCompare(b.providerName) || a.providerKey.localeCompare(b.providerKey),
    )

    const budgets: BudgetData = {}
    for (const budget of found) budgets[budget.providerKey] = budget

    this.logger.log('debug', `loadAll: loaded ${found.length} budgets, ${errorCount} errors`)
    return { budgets, hasErrors: errorCount > 0, errorCount }
  }

  /**
   * Load budget data for a single provider
   */
  async loadOne(providerKey: string): Promise<ProviderBudget | null> {
    const filePath = path.join(this.budgetDataDir, `${providerKey}.json`)

    let data: KeyInfoFile
    try {
      data = JSON.parse(await readFile(filePath, 'utf-8')) as KeyInfoFile
    } catch (error) {
      this.reportError(providerKey, `Unreadable budget file ${providerKey}.json: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }

    const info = data?.keyInfo?.info
    if (!info || typeof info.spend !== 'number' || !Number.isFinite(info.spend)) {
      this.reportError(providerKey, `Invalid budget data for ${providerKey}: missing or invalid keyInfo.info.spend`)
      return null
    }

    const maxBudget = info.max_budget
    if (maxBudget != null && typeof maxBudget !== 'number') {
      this.reportError(providerKey, `Invalid budget data for ${providerKey}: keyInfo.info.max_budget is not a number`)
      return null
    }

    this.lastErrors.delete(providerKey)

    const limit = typeof maxBudget === 'number' && Number.isFinite(maxBudget) && maxBudget > 0 ? maxBudget : null
    const resolvedKey = data.providerKey ?? providerKey

    return {
      providerKey: resolvedKey,
      providerName: data.providerName ?? this.formatProviderName(resolvedKey),
      keyAlias: info.key_alias || 'Unknown',
      spend: info.spend,
      limit,
      remaining: limit === null ? null : limit - info.spend,
      percentUsed: limit === null ? null : (info.spend / limit) * 100,
      duration: info.budget_duration || null,
      resetAt: info.budget_reset_at || null,
      expiresAt: info.expires || 'Never',
      lastFetched: data.fetchedAt,
    }
  }

  private reportError(providerKey: string, message: string): void {
    if (this.lastErrors.get(providerKey) === message) return
    this.lastErrors.set(providerKey, message)
    this.logger.log('warn', message)
  }

  /**
   * Format provider key to display name
   * e.g., "litellm-prod" -> "LiteLLM Prod"
   */
  private formatProviderName(key: string): string {
    return key
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }
}
