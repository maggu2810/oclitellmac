import { expect, test } from "bun:test"
import { groupByBaseUrl, normalizeBaseUrl } from "../src/fetch"

const ep = (providerKey: string, baseUrl: string) => ({ providerKey, baseUrl })

test("normalizeBaseUrl strips trailing slashes and /v1", () => {
  expect(normalizeBaseUrl("https://a.example")).toBe("https://a.example")
  expect(normalizeBaseUrl("https://a.example/")).toBe("https://a.example")
  expect(normalizeBaseUrl("https://a.example/v1")).toBe("https://a.example")
  expect(normalizeBaseUrl("https://a.example/v1/")).toBe("https://a.example")
  expect(normalizeBaseUrl("https://a.example//")).toBe("https://a.example")
})

test("endpoints of one gateway share a group regardless of slash or /v1 suffix", () => {
  const groups = groupByBaseUrl([
    ep("one", "https://a.example"),
    ep("two", "https://a.example/"),
    ep("three", "https://a.example/v1"),
    ep("four", "https://a.example/v1/"),
  ])
  expect([...groups.keys()]).toEqual(["https://a.example"])
  expect(groups.get("https://a.example")!.map((e) => e.providerKey)).toEqual(["one", "two", "three", "four"])
})

test("different gateways stay separate and keep first-seen order", () => {
  const groups = groupByBaseUrl([
    ep("a1", "https://a.example"),
    ep("b1", "https://b.example/v1"),
    ep("a2", "https://a.example/"),
    ep("c1", "https://a.example:8443"),
  ])
  expect([...groups.keys()]).toEqual(["https://a.example", "https://b.example", "https://a.example:8443"])
  expect(groups.get("https://a.example")!.map((e) => e.providerKey)).toEqual(["a1", "a2"])
})

test("no endpoints give no groups", () => {
  expect(groupByBaseUrl([]).size).toBe(0)
})
