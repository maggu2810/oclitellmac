import { expect, test } from "bun:test"
import { buildModelEntry } from "../src/build"
import { ANTHROPIC_PACKAGE, toModelInfo } from "../src/toV2"

const hub = { model_group: "claude-sonnet-5", supports_function_calling: true }
const info = {
  input_cost_per_token: 0.000002,
  output_cost_per_token: 0.00001,
  cache_read_input_token_cost: 0.0000002,
  cache_creation_input_token_cost: 0.0000025,
  max_input_tokens: 200000,
  max_output_tokens: 64000,
  supports_reasoning: true,
  supports_adaptive_thinking: true,
  supports_reasoning_efforts: ["max", "xhigh"],
}
const entry = buildModelEntry(hub, info, "chat")

test("OpenAI-compatible route keeps today's behaviour", () => {
  const model = toModelInfo("p", entry, { enabled: true, anthropic: false, supportsPromptCacheKey: true })
  expect(model.package).toBeUndefined()
  expect(model.compatibility).toEqual({ supportsPromptCacheKey: true })
  expect(model.variants.map((variant) => variant.id)).toEqual(Object.keys(entry.variants))
  expect(model.variants[0].settings).toEqual({ reasoningEffort: model.variants[0].id })
})

test("Anthropic route uses the bundled Anthropic package", () => {
  expect(ANTHROPIC_PACKAGE).toBe("@opencode/ai/providers/anthropic")
})

test("Anthropic route sets the package and never the prompt cache key flag", () => {
  const model = toModelInfo("p", entry, { enabled: true, anthropic: true, supportsPromptCacheKey: true })
  expect(model.package).toBe(ANTHROPIC_PACKAGE)
  expect(model.compatibility).toBeUndefined()
})

test("Anthropic adaptive variants carry thinking and effort", () => {
  const model = toModelInfo("p", entry, { enabled: true, anthropic: true })
  expect(model.variants.map((variant) => variant.id)).toEqual(["low", "medium", "high", "xhigh", "max"])
  expect(model.variants[2].settings).toEqual({
    thinking: { type: "adaptive", display: "summarized" },
    effort: "high",
  })
})

test("Anthropic budget variants follow the output limit", () => {
  const budget = buildModelEntry({ model_group: "claude-haiku-4.5" }, { supports_reasoning: true, max_output_tokens: 64000, max_input_tokens: 200000 }, "chat")
  const model = toModelInfo("p", budget, { enabled: true, anthropic: true })
  expect(model.variants).toEqual([
    { id: "high", settings: { thinking: { type: "enabled", budgetTokens: 16000 } } },
    { id: "max", settings: { thinking: { type: "enabled", budgetTokens: 31999 } } },
  ])
})

test("models without reasoning have no Anthropic variants", () => {
  const plain = buildModelEntry({ model_group: "claude-x" }, {}, "chat")
  expect(toModelInfo("p", plain, { enabled: true, anthropic: true }).variants).toEqual([])
})

test("entries cached before thinking support still convert", () => {
  const { thinking: _, ...legacy } = entry
  expect(toModelInfo("p", legacy, { enabled: true, anthropic: true }).variants).toEqual([])
})

test("costs, limits and enabled state are the same on both routes", () => {
  const generic = toModelInfo("p", entry, { enabled: false, anthropic: false })
  const native = toModelInfo("p", entry, { enabled: false, anthropic: true })
  expect(native.cost).toEqual(generic.cost)
  expect(native.limit).toEqual(generic.limit)
  expect(native.enabled).toBe(false)
  expect(generic.cost[0].input).toBeCloseTo(2)
  expect(generic.cost[0].output).toBeCloseTo(10)
  expect(generic.cost[0].cache.read).toBeCloseTo(0.2)
  expect(generic.cost[0].cache.write).toBeCloseTo(2.5)
})
