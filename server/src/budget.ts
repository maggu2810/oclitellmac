import type { EndpointConfig } from "./config"
import { LiteLLMClient } from "./fetch"
import { StateManager } from "./state"

/**
 * Budget tracker with periodic polling and on-demand fetching
 */
export class BudgetTracker {
  private intervals = new Map<string, NodeJS.Timeout>()
  private providerNames = new Map<string, string>()
  
  constructor(
    private stateManager: StateManager,
    private pollInterval: number,
    private log: (message: string) => void
  ) {}
  
  /**
   * Fetch and store budget data for a provider
   */
  async fetchAndStore(
    providerKey: string,
    providerName: string,
    client: LiteLLMClient
  ): Promise<void> {
    try {
      const keyInfo = await client.fetchKeyInfo()
      
      await this.stateManager.saveBudgetData(providerKey, {
        providerKey,
        providerName,
        fetchedAt: Date.now(),
        keyInfo,
      })
      
      this.log(`Budget data updated for ${providerKey}`)
    } catch (error) {
      this.log(
        `Failed to fetch budget for ${providerKey}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  
  /**
   * Start periodic budget tracking for a provider
   */
  startTracking(providerKey: string, providerName: string, client: LiteLLMClient): void {
    if (this.intervals.has(providerKey)) {
      this.log(`Budget tracking already active for ${providerKey}`)
      return
    }
    
    // Store provider name for periodic fetches
    this.providerNames.set(providerKey, providerName)
    
    // Initial fetch
    this.fetchAndStore(providerKey, providerName, client).catch(() => {
      // Error already logged in fetchAndStore
    })
    
    // Periodic fetch
    const interval = setInterval(() => {
      const name = this.providerNames.get(providerKey) ?? providerKey
      this.fetchAndStore(providerKey, name, client).catch(() => {
        // Error already logged in fetchAndStore
      })
    }, this.pollInterval * 1000)
    
    this.intervals.set(providerKey, interval)
    this.log(`Started budget tracking for ${providerKey} (interval: ${this.pollInterval}s)`)
  }
  
  /**
   * Stop tracking for a specific provider
   */
  stopTracking(providerKey: string): void {
    const interval = this.intervals.get(providerKey)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(providerKey)
      this.log(`Stopped budget tracking for ${providerKey}`)
    }
  }
  
  /**
   * Stop all tracking
   */
  stopAll(): void {
    for (const [key] of this.intervals) {
      this.stopTracking(key)
    }
  }
}
