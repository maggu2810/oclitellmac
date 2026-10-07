import { expect, test } from "bun:test"
import { firstDivergence, summarizeRequest } from "../src/diagnostics"

const cc = { type: "ephemeral" }
const body = (tail: string, system = "base") => ({
  model: "claude-sonnet-5",
  max_tokens: 100,
  stream: true,
  thinking: { type: "adaptive" },
  tools: [{ name: "a", input_schema: {}, cache_control: cc }],
  system: [{ type: "text", text: system, cache_control: cc }],
  messages: [
    { role: "user", content: [{ type: "text", text: "first" }] },
    { role: "assistant", content: [{ type: "text", text: "reply" }] },
    { role: "user", content: [{ type: "text", text: tail, cache_control: cc }] },
  ],
})

test("counts blocks and breakpoints without exposing content", () => {
  const summary = summarizeRequest(body("tail"))
  expect(summary.cache_control_present).toBe(true)
  expect(summary.cache_control_block_count).toBe(3)
  expect(summary.system_block_count).toBe(1)
  expect(summary.tool_count).toBe(1)
  expect(JSON.stringify(summary)).not.toContain("first")
  expect(summary.tool_schema_hash).toStartWith("sha256:")
})

test("the stable prefix ignores the moving tail but not the system prompt", () => {
  const a = summarizeRequest(body("tail one"))
  expect(summarizeRequest(body("tail two")).stable_prefix_hash).toBe(a.stable_prefix_hash)
  expect(summarizeRequest(body("tail one", "changed")).stable_prefix_hash).not.toBe(a.stable_prefix_hash)
})

test("max_tokens does not affect the options hash but thinking does", () => {
  const a = summarizeRequest(body("t"))
  expect(summarizeRequest({ ...body("t"), max_tokens: 5 }).provider_options_hash).toBe(a.provider_options_hash)
  expect(summarizeRequest({ ...body("t"), thinking: { type: "disabled" } }).provider_options_hash).not.toBe(
    a.provider_options_hash,
  )
})

test("a request without breakpoints is reported as such", () => {
  const summary = summarizeRequest({ model: "m", messages: [{ role: "user", content: "hi" }] })
  expect(summary.cache_control_present).toBe(false)
  expect(summary.cache_control_block_count).toBe(0)
})

test("firstDivergence locates changes and treats extensions as stable", () => {
  expect(firstDivergence(["a", "b"], ["a", "b", "c"])).toBeNull()
  expect(firstDivergence(["a", "b"], ["a", "x", "c"])).toBe(1)
  expect(firstDivergence(["a", "b", "c"], ["a", "b"])).toBe(2)
})
