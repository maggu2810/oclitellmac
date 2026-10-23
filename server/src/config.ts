import { z } from "zod"
import { readFile } from "fs/promises"
import { getConfigPath } from "./paths"
import type { Category } from "./categorize"

// Valid non-chat category names
const CategorySchema = z.enum([
  "embedding",
  "audio_speech",
  "transcription",
  "image_generation",
  "video_generation",
  "ocr",
  "ranking",
  "router",
])

// Additional OpenCode provider `options.*` fields forwarded verbatim into
// the injected provider's `options` block, alongside `baseURL` / `apiKey`.
// See OpenCode's ProviderConfig schema
// (packages/core/src/v1/config/provider.ts) and
// docs/litellm-integration/field-coverage-comparison.md §1 for field
// semantics.
const ProviderOptionsSchema = z.object({
  // Milliseconds. `false` disables the timeout entirely.
  timeout: z.union([z.number(), z.literal(false)]).optional(),
  // Milliseconds between streamed SSE chunks before aborting.
  chunkTimeout: z.union([z.number(), z.literal(false)]).optional(),
  // Milliseconds to wait for response headers. `false` disables it.
  headerTimeout: z.union([z.number(), z.literal(false)]).optional(),
  // Marks every model of this provider as supporting a prompt cache key.
  setCacheKey: z.boolean().optional(),
})

// Endpoint configuration schema
export const EndpointConfigSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  providerKey: z.string(),
  providerName: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  enabledCategories: z.array(CategorySchema).optional(),
  enableAllCategories: z.boolean().optional().default(false),
  providerOptions: ProviderOptionsSchema.optional(),
  // Glob patterns (`*` only) matched against model IDs. Matching models use the
  // Anthropic-native Messages route instead of the OpenAI-compatible one.
  anthropicModels: z
    .array(z.string().regex(/^[\w.*:/@-]+$/, "Invalid model pattern"))
    .optional()
    .default(["claude-*"]),
  // Glob patterns for models that stay on the OpenAI-compatible route but get Anthropic-style
  // cache_control breakpoints (`compatibility.cacheFormat: "anthropic"`). Models matching
  // `anthropicModels` already get breakpoints and are not affected.
  cacheBreakpointModels: z
    .array(z.string().regex(/^[\w.*:/@-]+$/, "Invalid model pattern"))
    .optional()
    .default([]),
})

// Server configuration schema
export const ServerConfigSchema = z.object({
  endpoints: z.array(EndpointConfigSchema),
  options: z.object({
    timeout: z.number().optional().default(30),
    budgetPollInterval: z.number().optional().default(60),
    fallbackToCache: z.boolean().optional().default(true),
    // Logs only counts and hashes of outgoing requests, to diagnose prompt-cache misses.
    cachePrefixDiagnostics: z.boolean().optional().default(false),
    // Logs a line for every budget refresh (one per endpoint and minute, plus one per prompt).
    budgetUpdateDiagnostics: z.boolean().optional().default(false),
    // Settings of the sidebar plugin, which reads them from this file.
    tui: z
      .object({
        // Lowest level written to ~/.local/state/oclitellmac/log/tui. `debug` also logs every budget reload.
        logLevel: z.enum(["error", "warn", "info", "debug"]).optional().default("warn"),
        // What the sidebar shows at startup. The /budget command changes it while OpenCode runs.
        sidebarMode: z.enum(["current", "all", "hidden", "masked"]).optional().default("current"),
      })
      .optional()
      .default({}),
  }).optional().default({}),
})

export type ServerConfig = z.infer<typeof ServerConfigSchema>
export type EndpointConfig = z.infer<typeof EndpointConfigSchema>

/**
 * Load server configuration from ~/.config/oclitellmac/server.json
 */
export async function loadConfig(): Promise<ServerConfig> {
  const configPath = getConfigPath()
  
  try {
    const content = await readFile(configPath, "utf-8")
    const data = JSON.parse(content)
    return ServerConfigSchema.parse(data)
  } catch (error) {
    throw new Error(
      `Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Export getConfigPath from paths module for convenience
 * (Re-exported to maintain backward compatibility if used elsewhere)
 */
export { getConfigPath } from "./paths"
