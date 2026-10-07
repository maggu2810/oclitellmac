import { expect, test } from "bun:test"
import { matchesAny } from "../src/match"

test("claude-* matches Claude IDs including alias suffixes", () => {
  const patterns = ["claude-*"]
  expect(matchesAny("claude-sonnet-5", patterns)).toBe(true)
  expect(matchesAny("claude-opus-4.8-preview", patterns)).toBe(true)
  expect(matchesAny("claude-sonnet-latest", patterns)).toBe(true)
})

test("non-Claude IDs and unanchored names do not match", () => {
  const patterns = ["claude-*"]
  expect(matchesAny("gpt-5", patterns)).toBe(false)
  expect(matchesAny("gemini-2.5-pro", patterns)).toBe(false)
  expect(matchesAny("my-claude-clone", patterns)).toBe(false)
})

test("an empty list matches nothing", () => {
  expect(matchesAny("claude-sonnet-5", [])).toBe(false)
})

test("regex characters in patterns are literal and matching ignores case", () => {
  expect(matchesAny("axb", ["a.b"])).toBe(false)
  expect(matchesAny("a.b", ["a.b"])).toBe(true)
  expect(matchesAny("Claude-Opus-5", ["claude-*"])).toBe(true)
})
