import { expect, test } from "bun:test"
import { BudgetTracker } from "../src/budget"
import { ServerConfigSchema } from "../src/config"
import type { LiteLLMClient } from "../src/fetch"
import type { StateManager } from "../src/state"

const endpoint = { baseUrl: "https://example.com", apiKey: "k", providerKey: "p" }

function setup(logUpdates?: boolean, fail = false) {
  const saved: string[] = []
  const logs: string[] = []
  const state = { saveBudgetData: async (key: string) => void saved.push(key) } as unknown as StateManager
  const client = {
    fetchKeyInfo: async () => {
      if (fail) throw new Error("boom")
      return { info: { spend: 1, max_budget: 2 } }
    },
  } as unknown as LiteLLMClient
  const tracker = new BudgetTracker(state, 60, (message) => logs.push(message), logUpdates)
  return { tracker, client, saved, logs }
}

test("budget update lines are off by default", async () => {
  const { tracker, client, saved, logs } = setup()
  await tracker.fetchAndStore("p", "P", client)
  expect(saved).toEqual(["p"])
  expect(logs).toEqual([])
})

test("budget update lines are logged when enabled", async () => {
  const { tracker, client, logs } = setup(true)
  await tracker.fetchAndStore("p", "P", client)
  expect(logs).toEqual(["Budget data updated for p"])
})

test("fetch failures are always logged", async () => {
  const { tracker, client, saved, logs } = setup(false, true)
  await tracker.fetchAndStore("p", "P", client)
  expect(saved).toEqual([])
  expect(logs).toEqual(["Failed to fetch budget for p: boom"])
})

test("budgetUpdateDiagnostics defaults to false", () => {
  expect(ServerConfigSchema.parse({ endpoints: [endpoint] }).options.budgetUpdateDiagnostics).toBe(false)
  expect(
    ServerConfigSchema.parse({ endpoints: [endpoint], options: { budgetUpdateDiagnostics: true } }).options
      .budgetUpdateDiagnostics,
  ).toBe(true)
})
