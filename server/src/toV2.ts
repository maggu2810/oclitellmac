import type { Model, Provider } from "@opencode/plugin"

type AnyRecord = Record<string, any>

/** Convert a LiteLLM-derived model entry (see build.ts) into a V2 `Model.Info`. */
export function toModelInfo(
  providerKey: string,
  entry: AnyRecord,
  enabled: boolean,
  supportsPromptCacheKey = false,
): Model.Info {
  const id = entry.id as Model.ID
  const cost = entry.cost as AnyRecord | undefined
  const tier = cost?.context_over_200k as AnyRecord | undefined
  const cache = (source: AnyRecord) => ({
    read: source.cache_read ?? 0,
    write: source.cache_write ?? 0,
  })

  return {
    id,
    modelID: id,
    providerID: providerKey as Provider.ID,
    name: entry.name ?? entry.id,
    ...(supportsPromptCacheKey ? { compatibility: { supportsPromptCacheKey } } : {}),
    capabilities: {
      tools: entry.tool_call === true,
      input: entry.modalities?.input ?? ["text"],
      output: entry.modalities?.output ?? ["text"],
    },
    variants: Object.keys(entry.variants ?? {}).map((effort) => ({
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
    enabled,
    limit: entry.limit
      ? { context: entry.limit.context, input: entry.limit.input, output: entry.limit.output }
      : { context: 200_000, output: 32_000 },
  }
}
