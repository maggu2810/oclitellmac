import type { Model, Plugin, Provider } from "@opencode/plugin"
import { appendFile } from "fs/promises"
import path from "path"
import { loadConfig, getConfigPath } from "./config"
import { getStateDir } from "./paths"
import { toModelInfo } from "./toV2"
import { LiteLLMClient } from "./fetch"
import { transformModels } from "./transform"
import { buildBlacklist } from "./filter"
import type { Category } from "./categorize"
import { StateManager } from "./state"
import { BudgetTracker } from "./budget"

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
    const log = (message: string) => {
      appendFile(logFile, `${new Date().toISOString()} ${message}\n`).catch(() => {})
    }

    const stateManager = new StateManager()
    await stateManager.ensureDirectories()

    const config = await loadConfig().catch((error) => {
      log(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`)
      log(`Please create ${getConfigPath()} with your LiteLLM endpoint configuration`)
      return undefined
    })
    if (!config) return

    const { budgetPollInterval, fallbackToCache, timeout } = config.options
    const budgetTracker = new BudgetTracker(stateManager, budgetPollInterval, log)
    const clientMap = new Map<string, { client: LiteLLMClient; name: string }>()
    const entries: Array<{ info: Provider.Info; models: Model.Info[] }> = []

    for (const endpoint of config.endpoints) {
      if (!endpoint.enabled) {
        log(`Skipping disabled endpoint: ${endpoint.providerKey}`)
        continue
      }

      const client = new LiteLLMClient(endpoint.baseUrl, endpoint.apiKey, timeout)
      let models: Record<string, any> = {}
      let categories = new Map<string, Category>()

      try {
        log(`Fetching models for ${endpoint.providerKey} from ${endpoint.baseUrl}...`)
        const [hubEntries, infoMap] = await Promise.all([client.fetchModelHub(), client.fetchModelInfo()])
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
          continue
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

      entries.push({
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
          toModelInfo(endpoint.providerKey, entry, !disabled.has(entry.id), setCacheKey),
        ),
      })
      clientMap.set(endpoint.providerKey, { client, name })
      budgetTracker.startTracking(endpoint.providerKey, name, client)
    }

    log(`Provider injection complete: ${entries.length}/${config.endpoints.length} endpoints`)

    await ctx.provider.transform((editor) => {
      entries.forEach((entry) => editor.add(entry))
    })

    await ctx.session.hook("prompt", () => {
      clientMap.forEach(({ client, name }, providerKey) => {
        budgetTracker.fetchAndStore(providerKey, name, client).catch(() => {})
      })
    })

    return () => budgetTracker.stopAll()
  },
} satisfies Plugin.Plugin
