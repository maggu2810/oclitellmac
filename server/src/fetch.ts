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
  model_info?: {
    supports_function_calling?: boolean
    supports_vision?: boolean
    supports_reasoning?: boolean
    supports_audio_input?: boolean
    supports_pdf_input?: boolean
    supports_audio_output?: boolean
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

export interface KeyInfoResponse {
  key_alias?: string
  spend?: number
  max_budget?: number
  budget_remaining?: number
  budget_reset_at?: string
  // Add other fields as needed from LiteLLM /key/info response
}

export class LiteLLMClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private timeout: number = 30
  ) {}
  
  /**
   * Normalize base URL (remove trailing slashes and /v1)
   */
  private normalizeBaseUrl(): string {
    return this.baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "")
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
      
      const data = await response.json()
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
      
      const data = await response.json()
      const result: Record<string, any> = {}
      
      for (const item of data.data || []) {
        const key = item.key || item.model_name
        if (key) {
          result[key] = item.model_info || {}
        }
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
      
      return await response.json()
    } catch (error) {
      throw new Error(
        `Failed to fetch key info from ${url}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
