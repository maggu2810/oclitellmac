import { z } from "zod"
import { readFile } from "fs/promises"
import { getConfigPath } from "./paths.js"
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

// Endpoint configuration schema
export const EndpointConfigSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string(),
  providerKey: z.string(),
  providerName: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  enabledCategories: z.array(CategorySchema).optional(),
  enableAllCategories: z.boolean().optional().default(false),
})

// Server configuration schema
export const ServerConfigSchema = z.object({
  endpoints: z.array(EndpointConfigSchema),
  options: z.object({
    timeout: z.number().optional().default(30),
    budgetPollInterval: z.number().optional().default(60),
    fallbackToCache: z.boolean().optional().default(true),
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
export { getConfigPath } from "./paths.js"
