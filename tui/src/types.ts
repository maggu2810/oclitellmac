/** @jsxImportSource @opentui/solid */

/**
 * Raw structure from ~/.local/state/oclitellmac/key-info/<provider>.json
 * 
 * This matches the LiteLLM /key/info endpoint response structure.
 * Response has nested structure: {key: string, info: {...}}
 */
export interface KeyInfoFile {
  providerKey: string
  providerName?: string
  fetchedAt: number
  keyInfo: {
    key: string
    info: {
      key_alias: string
      spend: number
      /** null/absent when the key has no spend limit */
      max_budget?: number | null
      budget_duration?: string
      budget_reset_at?: string
      expires?: string
      key_name?: string
      soft_budget_cooldown?: boolean
      models?: string[]
      aliases?: Record<string, any>
      config?: Record<string, any>
    }
  }
}

/**
 * Normalized budget data for UI display
 */
export interface ProviderBudget {
  providerKey: string
  providerName: string
  keyAlias: string
  spend: number
  /** null when the key has no usable limit (none set, or 0) */
  limit: number | null
  remaining: number | null
  percentUsed: number | null
  /** null when unknown */
  duration: string | null
  /** null when unknown */
  resetAt: string | null
  expiresAt: string
  lastFetched: number
}

/**
 * All providers budget data (keyed by provider key)
 */
export type BudgetData = Record<string, ProviderBudget>
