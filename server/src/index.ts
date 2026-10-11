import type { Model, Plugin, Provider } from "@opencode/plugin"
import path from "path"
import { loadConfig, getConfigPath } from "./config"
import { getStateDir } from "./paths"
import { toModelInfo } from "./toV2"
import { matchesAny } from "./match"
import { firstDivergence, summarizeRequest } from "./diagnostics"
import { randomUUID } from "crypto"
import { LiteLLMClient, groupByBaseUrl, normalizeBaseUrl, type ModelHubEntry } from "./fetch"
import { transformModels } from "./transform"
import { buildBlacklist } from "./filter"
import type { Category } from "./categorize"
import { StateManager } from "./state"
import { BudgetTracker } from "./budget"
import { RotatingLog } from "./log"

/**
 * Format provider key into display name
 * Examples: "litellm-prod" → "Litellm Prod", "my-proxy" → "My Proxy"
 */
function formatProviderName(key: string): string {
  return key
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const ALL_NON_CHAT: Category[] = [
  "embedding",
  "audio_speech",
  "transcription",
  "image_generation",
  "video_generation",
  "ocr",
  "ranking",
  "router",
]

const MAX_LOG_BYTES = 2 * 1024 * 1024
const FETCH_CONCURRENCY = 8

/** Run `fn` over `items` with at most `limit` in flight; results keep the input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * oclitellmac-server plugin
 *
 * Automatically configures multiple LiteLLM proxy endpoints as OpenCode providers.
 * No manual opencode.json editing required.
 */
export default {
  id: "oclitellmac.server",
  async setup(ctx: Plugin.Context) {
    const logFile = path.join(getStateDir(), "server.log")
    const rotatingLog = new RotatingLog(logFile, MAX_LOG_BYTES)
    const log = (message: string) => {
      void rotatingLog.append(`${new Date().toISOString()} ${message}`)
    }

    const stateManager = new StateManager()
    await stateManager.ensureDirectories()

    const config = await loadConfig().catch((error) => {
      log(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`)
      log(`Please create ${getConfigPath()} with your LiteLLM endpoint configuration`)
      return undefined
    })
    if (!config) return

    const { budgetPollInterval, fallbackToCache, timeout, cachePrefixDiagnostics, budgetUpdateDiagnostics } = config.options
    const budgetTracker = new BudgetTracker(stateManager, budgetPollInterval, log, budgetUpdateDiagnostics)
    type Endpoint = (typeof config.endpoints)[number]
    type Loaded = { entry: { info: Provider.Info; models: Model.Info[] }; name: string; client: LiteLLMClient }

    const enabledEndpoints = config.endpoints.filter((endpoint) => {
      if (!endpoint.enabled) log(`Skipping disabled endpoint: ${endpoint.providerKey}`)
      return endpoint.enabled
    })

    // /public/model_hub is identical for every endpoint of a gateway, so it is fetched once per base URL.
    const hubs = new Map<string, Promise<ModelHubEntry[]>>()
    for (const [baseUrl, group] of groupByBaseUrl(enabledEndpoints)) {
      const hub = new LiteLLMClient(group[0].baseUrl, group[0].apiKey, timeout).fetchModelHub()
      hub.catch(() => {})
      hubs.set(baseUrl, hub)
    }

    const loadEndpoint = async (endpoint: Endpoint): Promise<Loaded | undefined> => {
      const client = new LiteLLMClient(endpoint.baseUrl, endpoint.apiKey, timeout)
      let models: Record<string, any> = {}
      let categories = new Map<string, Category>()

      try {
        log(`Fetching models for ${endpoint.providerKey} from ${endpoint.baseUrl}...`)
        const [hubEntries, infoMap] = await Promise.all([hubs.get(normalizeBaseUrl(endpoint.baseUrl))!, client.fetchModelInfo()])
        const result = transformModels(hubEntries, infoMap)
        models = result.models
        categories = result.categories
        await stateManager.saveProviderCache(endpoint.providerKey, {
          providerKey: endpoint.providerKey,
          baseUrl: endpoint.baseUrl,
          fetchedAt: Date.now(),
          models,
          categories: Object.fromEntries(categories),
        })
        log(`Loaded ${Object.keys(models).length} models for ${endpoint.providerKey}`)
      } catch (error) {
        log(
          `Failed to fetch models for ${endpoint.providerKey}: ${error instanceof Error ? error.message : String(error)}`,
        )
        const cached = fallbackToCache ? await stateManager.loadProviderCache(endpoint.providerKey) : undefined
        if (!cached?.models) {
          log(`No cached data available for ${endpoint.providerKey}`)
          return undefined
        }
        models = cached.models
        categories = new Map(Object.entries(cached.categories ?? {}))
        log(`Using cached data for ${endpoint.providerKey} (cached at: ${new Date(cached.fetchedAt).toISOString()})`)
      }

      const enabledCategories = new Set<Category>(
        endpoint.enableAllCategories ? ALL_NON_CHAT : ((endpoint.enabledCategories ?? []) as Category[]),
      )
      const disabled = new Set(buildBlacklist(categories, enabledCategories).map(([modelId]) => modelId))
      const name = endpoint.providerName ?? formatProviderName(endpoint.providerKey)
      const { setCacheKey, ...settingsOptions } = endpoint.providerOptions ?? {}

      return {
        name,
        client,
        entry: {
          info: {
            id: endpoint.providerKey as Provider.ID,
            name,
            activation: "enabled",
            package: "@opencode/ai/providers/openai-compatible",
            settings: {
              baseURL: `${endpoint.baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "")}/v1`,
              apiKey: endpoint.apiKey,
              ...settingsOptions,
            },
          },
          models: Object.values(models).map((entry) =>
            toModelInfo(endpoint.providerKey, entry, {
              enabled: !disabled.has(entry.id),
              anthropic: matchesAny(entry.id, endpoint.anthropicModels),
              supportsPromptCacheKey: setCacheKey,
            }),
          ),
        },
      }
    }

    const loaded = await mapLimit(enabledEndpoints, FETCH_CONCURRENCY, loadEndpoint)
    const entries: Array<{ info: Provider.Info; models: Model.Info[] }> = []
    enabledEndpoints.forEach((endpoint, index) => {
      const result = loaded[index]
      if (!result) return
      entries.push(result.entry)
      budgetTracker.startTracking(endpoint.providerKey, result.name, result.client)
    })

    log(`Provider injection complete: ${entries.length}/${config.endpoints.length} endpoints`)
    entries.forEach((entry) =>
      log(
        `${entry.info.id}: ${entry.models.filter((model) => model.package).length}/${entry.models.length} models use the Anthropic route`,
      ),
    )

    await ctx.provider.transform((editor) => {
      entries.forEach((entry) => editor.add(entry))
    })

    await ctx.session.hook("model.request", (event) => {
      if (event.kind !== "primary") return
      budgetTracker.refreshForRequest(event.model.providerID).catch(() => {})
    })

    if (cachePrefixDiagnostics) {
      const previous = new Map<string, string[]>()
      await ctx.session.hook("http.request", async (event) => {
        if (event.kind !== "primary") return
        const body = await event.request.clone().json().catch(() => undefined)
        if (typeof body !== "object" || body === null) return
        const { block_hashes, ...summary } = summarizeRequest(body)
        const before = previous.get(event.sessionID)
        previous.set(event.sessionID, block_hashes)
        log(
          JSON.stringify({
            request_id: randomUUID(),
            provider: event.model.providerID,
            model: event.model.id,
            ...summary,
            first_divergence_index: before ? firstDivergence(before, block_hashes) : null,
          }),
        )
      })
    }

    return () => budgetTracker.stopAll()
  },
} satisfies Plugin.Plugin
