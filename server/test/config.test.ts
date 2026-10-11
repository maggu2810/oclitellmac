import { expect, test } from "bun:test"
import { EndpointConfigSchema, ServerConfigSchema } from "../src/config"

const endpoint = { baseUrl: "https://example.com", apiKey: "k", providerKey: "p" }

test("anthropicModels defaults to claude-*", () => {
  expect(EndpointConfigSchema.parse(endpoint).anthropicModels).toEqual(["claude-*"])
})

test("an empty list disables the Anthropic route", () => {
  expect(EndpointConfigSchema.parse({ ...endpoint, anthropicModels: [] }).anthropicModels).toEqual([])
})

test("custom patterns are kept", () => {
  const parsed = EndpointConfigSchema.parse({ ...endpoint, anthropicModels: ["claude-sonnet-*", "claude-opus-5"] })
  expect(parsed.anthropicModels).toEqual(["claude-sonnet-*", "claude-opus-5"])
})

test("invalid patterns are rejected", () => {
  expect(EndpointConfigSchema.safeParse({ ...endpoint, anthropicModels: "claude-*" }).success).toBe(false)
  expect(EndpointConfigSchema.safeParse({ ...endpoint, anthropicModels: [""] }).success).toBe(false)
  expect(EndpointConfigSchema.safeParse({ ...endpoint, anthropicModels: ["claude (x)"] }).success).toBe(false)
})

test("diagnostics are off by default", () => {
  expect(ServerConfigSchema.parse({ endpoints: [endpoint] }).options.cachePrefixDiagnostics).toBe(false)
})

test("tui options default to quiet logging and the current provider", () => {
  const parsed = ServerConfigSchema.parse({ endpoints: [endpoint] }).options.tui
  expect(parsed).toEqual({ logLevel: "warn", sidebarMode: "current" })
})

test("tui options reject unknown values", () => {
  const options = (tui: unknown) => ServerConfigSchema.safeParse({ endpoints: [endpoint], options: { tui } }).success
  expect(options({ logLevel: "debug", sidebarMode: "masked" })).toBe(true)
  expect(options({ logLevel: "verbose" })).toBe(false)
  expect(options({ sidebarMode: "everything" })).toBe(false)
})
