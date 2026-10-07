import type { Model, Provider } from "@opencode/plugin"
import type { Thinking } from "./map"

type AnyRecord = Record<string, any>

// Not `anthropic-compatible`: the compiled opencode binary only bundles the packages in its builtin list.
export const ANTHROPIC_PACKAGE = "@opencode/ai/providers/anthropic"

const ADAPTIVE_THINKING = { type: "adaptive", display: "summarized" }
const ANTHROPIC_OUTPUT_TOKEN_MAX = 32_000
const MIN_THINKING_BUDGET = 1_024

export interface ModelOptions {
  enabled: boolean
  /** Use the Anthropic-native Messages route for this model. */
  anthropic: boolean
  /** Send OpenAI's `prompt_cache_key` (OpenAI-compatible route only). */
  supportsPromptCacheKey?: boolean
}

/** Convert a LiteLLM-derived model entry (see build.ts) into a V2 `Model.Info`. */
export function toModelInfo(providerKey: string, entry: AnyRecord, options: ModelOptions): Model.Info {
  const id = entry.id as Model.ID
  const cost = entry.cost as AnyRecord | undefined
  const tier = cost?.context_over_200k as AnyRecord | undefined
  const cache = (source: AnyRecord) => ({
    read: source.cache_read ?? 0,
    write: source.cache_write ?? 0,
  })
  const limit = entry.limit
    ? { context: entry.limit.context, input: entry.limit.input, output: entry.limit.output }
    : { context: 200_000, output: 32_000 }

  return {
    id,
    modelID: id,
    providerID: providerKey as Provider.ID,
    name: entry.name ?? entry.id,
    ...(options.anthropic
      ? { package: ANTHROPIC_PACKAGE }
      : options.supportsPromptCacheKey
        ? { compatibility: { supportsPromptCacheKey: true } }
        : {}),
    capabilities: {
      tools: entry.tool_call === true,
      input: entry.modalities?.input ?? ["text"],
      output: entry.modalities?.output ?? ["text"],
    },
    variants: options.anthropic
      ? anthropicVariants(entry.thinking, limit.output)
      : Object.keys(entry.variants ?? {}).map((effort) => ({
          id: effort as Model.VariantID,
          settings: { reasoningEffort: effort },
        })),
    time: { released: 0 },
    cost: cost
      ? [
          { input: cost.input, output: cost.output, cache: cache(cost) },
          ...(tier
            ? [
                {
                  tier: { type: "context" as const, size: 200_000 },
                  input: tier.input,
                  output: tier.output,
                  cache: cache(tier),
                },
              ]
            : []),
        ]
      : [],
    status: entry.status ?? "active",
    enabled: options.enabled,
    limit,
  }
}

function anthropicVariants(thinking: Thinking | undefined, outputLimit: number): Model.Info["variants"] {
  if (thinking === undefined) return []
  if (thinking.mode === "adaptive")
    return thinking.efforts.map((effort) => ({
      id: effort as Model.VariantID,
      settings: { thinking: ADAPTIVE_THINKING, effort },
    }))
  const maximum = Math.min(ANTHROPIC_OUTPUT_TOKEN_MAX, outputLimit) - 1
  if (maximum <= 0) return []
  const high = Math.min(Math.max(MIN_THINKING_BUDGET, Math.floor((maximum + 1) / 2)), maximum)
  return [
    { id: "high" as Model.VariantID, settings: { thinking: { type: "enabled", budgetTokens: high } } },
    { id: "max" as Model.VariantID, settings: { thinking: { type: "enabled", budgetTokens: maximum } } },
  ]
}
