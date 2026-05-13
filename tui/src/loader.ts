import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { getBudgetDataDir } from './paths.js'
import type { KeyInfoFile, ProviderBudget, BudgetData } from './types'
import type { TuiLogger } from './log'

/**
 * Budget data loader - reads budget files from ~/.local/state/oclitellmac/key-info/
 */
export class BudgetLoader {
  private budgetDataDir: string
  private logger: TuiLogger

  constructor(logger: TuiLogger) {
    this.logger = logger
    this.budgetDataDir = getBudgetDataDir()
  }

  /**
   * Get the budget data directory path
   */
  getBudgetDataDir(): string {
    return this.budgetDataDir
  }

  /**
   * Load all budget files from key-info directory
   */
  async loadAll(): Promise<{ budgets: BudgetData; hasErrors: boolean; errorCount: number }> {
    this.logger.log('info', `loadAll: starting, budgetDataDir=${this.budgetDataDir}`)
    const budgets: BudgetData = {}
    let errorCount = 0

    try {
      const files = await readdir(this.budgetDataDir)
      this.logger.log('info', `loadAll: found ${files.length} files`)
      const jsonFiles = files.filter(f => f.endsWith('.json'))

      for (const file of jsonFiles) {
        const providerKey = file.replace('.json', '')
        const budget = await this.loadOne(providerKey)

        if (budget) {
          budgets[providerKey] = budget
          this.logger.log('info', `loadAll: loaded budget for ${providerKey}`)
        } else {
          errorCount++
          this.logger.log('warn', `Failed to parse budget data for ${providerKey}`)
        }
      }
    } catch (error) {
      // Directory doesn't exist yet or is inaccessible
      this.logger.log('info', 'Budget directory not found - waiting for server plugin')
    }

    return {
      budgets,
      hasErrors: errorCount > 0,
      errorCount
    }
  }

  /**
   * Load budget data for a single provider
   */
  async loadOne(providerKey: string): Promise<ProviderBudget | null> {
    const filePath = path.join(this.budgetDataDir, `${providerKey}.json`)

    try {
      const content = await readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as KeyInfoFile

      // Validate required fields (nested under info)
      if (
        !data.keyInfo?.info ||
        typeof data.keyInfo.info.spend !== 'number' ||
        typeof data.keyInfo.info.max_budget !== 'number'
      ) {
        this.logger.log('error', `Invalid budget data for ${data.providerKey}: missing or invalid keyInfo.info fields`)
        return null
      }

      // Transform to normalized format
      return {
        providerKey: data.providerKey,
        providerName: data.providerName ?? this.formatProviderName(data.providerKey),
        keyAlias: data.keyInfo.info.key_alias || 'Unknown',
        spend: data.keyInfo.info.spend,
        limit: data.keyInfo.info.max_budget,
        remaining: data.keyInfo.info.max_budget - data.keyInfo.info.spend,
        percentUsed: (data.keyInfo.info.spend / data.keyInfo.info.max_budget) * 100,
        duration: data.keyInfo.info.budget_duration || 'Unknown',
        resetAt: data.keyInfo.info.budget_reset_at || 'Unknown',
        expiresAt: data.keyInfo.info.expires || 'Never',
        lastFetched: data.fetchedAt,
      }
    } catch (error) {
      // File doesn't exist, invalid JSON, or missing fields
      return null
    }
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
