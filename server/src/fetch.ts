/**
 * LiteLLM API client for fetching models and budget data
 */

export interface ModelHubEntry {
  model_group: string
  mode?: string
  supports_function_calling?: boolean
  supports_parallel_function_calling?: boolean
  supports_vision?: boolean
  supports_reasoning?: boolean
  input_cost_per_token?: number
  output_cost_per_token?: number
  max_input_tokens?: number
  max_output_tokens?: number
  cache_read_input_token_cost?: number
  cache_creation_input_token_cost?: number
  input_cost_per_token_above_128k_tokens?: number
  output_cost_per_token_above_128k_tokens?: number
  input_cost_per_token_above_200k_tokens?: number
  output_cost_per_token_above_200k_tokens?: number
}

export interface ModelInfoEntry {
  key?: string
  model_name?: string
  litellm_params?: Record<string, unknown>
  model_info?: {
    supports_function_calling?: boolean
    supports_vision?: boolean
    supports_reasoning?: boolean
    supports_audio_input?: boolean
    supports_pdf_input?: boolean
    supports_audio_output?: boolean
    /**
     * Reasoning-effort levels this model accepts (e.g. `["low", "medium",
     * "high"]`). Not a native LiteLLM field — derived by scanning
     * `supports_<level>_reasoning_effort` boolean flags on this object and
     * on the sibling `litellm_params` object. See `fetchModelInfo()`.
     */
    supports_reasoning_efforts?: string[]
    input_cost_per_token?: number
    output_cost_per_token?: number
    max_input_tokens?: number
    max_output_tokens?: number
    cache_read_input_token_cost?: number
    cache_creation_input_token_cost?: number
    input_cost_per_token_above_128k_tokens?: number
    output_cost_per_token_above_128k_tokens?: number
  }
}

/** Matches LiteLLM flags like `supports_low_reasoning_effort` -> `"low"`. */
const REASONING_EFFORT_FLAG = /^supports_([a-z]+)_reasoning_effort$/

/**
 * Derive the set of reasoning-effort levels a model supports by scanning
 * `supports_<level>_reasoning_effort` boolean flags across `model_info` and
 * `litellm_params`. LiteLLM does not report this as a single list field —
 * each level is its own boolean flag.
 */
function extractReasoningEfforts(...sources: Array<Record<string, unknown> | undefined>): string[] {
  const efforts = new Set<string>()
  for (const source of sources) {
    if (!source || typeof source !== "object") continue
    for (const [key, value] of Object.entries(source)) {
      const match = key.match(REASONING_EFFORT_FLAG)
      if (match && value === true) {
        efforts.add(match[1])
      }
    }
  }
  return [...efforts]
}

export interface KeyInfoFields {
  key_alias?: string | null
  spend?: number
  max_budget?: number | null
  budget_duration?: string | null
  budget_reset_at?: string | null
  expires?: string | null
  [field: string]: unknown
}

/** Shape of LiteLLM's `/key/info` response; only `info` is consumed. */
export interface KeyInfoResponse {
  key?: string
  info?: KeyInfoFields
  [field: string]: unknown
}

/** Remove trailing slashes and a `/v1` suffix. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "")
}

/**
 * Group endpoints by normalized base URL, keeping first-seen group order and
 * the endpoint order within each group.
 */
export function groupByBaseUrl<T extends { baseUrl: string }>(endpoints: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const endpoint of endpoints) {
    const key = normalizeBaseUrl(endpoint.baseUrl)
    const group = groups.get(key)
    if (group) group.push(endpoint)
    else groups.set(key, [endpoint])
  }
  return groups
}

export class LiteLLMClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private timeout: number = 30
  ) {}
  
  private normalizeBaseUrl(): string {
    return normalizeBaseUrl(this.baseUrl)
  }
  
  /**
   * Fetch model hub (public endpoint, no auth required)
   */
  async fetchModelHub(): Promise<ModelHubEntry[]> {
    const url = `${this.normalizeBaseUrl()}/public/model_hub`
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout * 1000),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = (await response.json()) as ModelHubEntry[] | { data?: ModelHubEntry[] }
      return Array.isArray(data) ? data : (data.data || [])
    } catch (error) {
      throw new Error(
        `Failed to fetch model hub from ${url}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  
  /**
   * Fetch model info (requires auth)
   */
  async fetchModelInfo(): Promise<Record<string, ModelInfoEntry["model_info"]>> {
    const url = `${this.normalizeBaseUrl()}/v1/model/info`
    
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(Math.max(this.timeout, 60) * 1000),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = (await response.json()) as { data?: ModelInfoEntry[] }
      const result: Record<string, any> = {}
      
      for (const item of data.data || []) {
        const key = item.key || item.model_name
        if (!key) continue
        const info = { ...(item.model_info || {}) }
        const efforts = extractReasoningEfforts(info, item.litellm_params)
        if (efforts.length > 0) {
          info.supports_reasoning_efforts = efforts
        }
        result[key] = info
      }
      
      return result
    } catch (error) {
      throw new Error(
        `Failed to fetch model info from ${url}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  
  /**
   * Fetch key info (budget data)
   */
  async fetchKeyInfo(): Promise<KeyInfoResponse> {
    const url = `${this.normalizeBaseUrl()}/key/info`
    
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(this.timeout * 1000),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return (await response.json()) as KeyInfoResponse
    } catch (error) {
      throw new Error(
        `Failed to fetch key info from ${url}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
