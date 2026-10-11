import { expect, test } from "bun:test"
import { BudgetTracker, pickBudgetFields } from "../src/budget"
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

function tracked(options: { fail?: boolean } = {}) {
  const calls: Record<string, number> = {}
  let clock = 0
  const state = { saveBudgetData: async () => {} } as unknown as StateManager
  const clientFor = (key: string) =>
    ({
      fetchKeyInfo: async () => {
        calls[key] = (calls[key] ?? 0) + 1
        if (options.fail) throw new Error("boom")
        return { info: { spend: 1 } }
      },
    }) as unknown as LiteLLMClient
  const tracker = new BudgetTracker(state, 60, () => {}, false, { now: () => clock })
  return { tracker, calls, clientFor, advance: (ms: number) => (clock += ms) }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test("pickBudgetFields keeps the TUI fields and drops everything else", () => {
  const picked = pickBudgetFields({
    key: "sk-secret",
    info: {
      key_alias: "alias",
      spend: 1.5,
      max_budget: 10,
      budget_duration: "30d",
      budget_reset_at: "2026-01-01T00:00:00Z",
      expires: null,
      user_id: "u",
      team_id: "t",
      metadata: { a: 1 },
    },
    extra: true,
  })
  expect(picked).toEqual({
    info: {
      key_alias: "alias",
      spend: 1.5,
      max_budget: 10,
      budget_duration: "30d",
      budget_reset_at: "2026-01-01T00:00:00Z",
      expires: null,
    },
  })
  expect(JSON.stringify(picked)).not.toContain("sk-secret")
})

test("pickBudgetFields keeps a null max_budget and leaves missing fields undefined", () => {
  const picked = pickBudgetFields({ info: { spend: 2, max_budget: null } })
  expect(picked.info.max_budget).toBeNull()
  expect(picked.info.key_alias).toBeUndefined()
  expect(picked.info.expires).toBeUndefined()
  expect(pickBudgetFields({}).info.spend).toBeUndefined()
})

test("fetchAndStore saves only the projected fields", async () => {
  let saved: any
  const state = { saveBudgetData: async (_key: string, data: unknown) => void (saved = data) } as unknown as StateManager
  const client = {
    fetchKeyInfo: async () => ({ key: "sk-secret", info: { spend: 1, max_budget: 2, user_id: "u" } }),
  } as unknown as LiteLLMClient
  await new BudgetTracker(state, 60, () => {}).fetchAndStore("p", "P", client)
  expect(Object.keys(saved).sort()).toEqual(["fetchedAt", "keyInfo", "providerKey", "providerName"])
  expect(saved.keyInfo.info.spend).toBe(1)
  expect(saved.keyInfo.info.user_id).toBeUndefined()
  expect(JSON.stringify(saved)).not.toContain("sk-secret")
})

test("requests refresh a provider at most once per throttle window", async () => {
  const { tracker, calls, clientFor, advance } = tracked()
  tracker.startTracking("a", "A", clientFor("a"))
  await flush()
  expect(calls.a).toBe(1)

  advance(5_000)
  expect(await tracker.refreshForRequest("a")).toBe(false)
  expect(calls.a).toBe(1)

  advance(6_000)
  expect(await tracker.refreshForRequest("a")).toBe(true)
  expect(await tracker.refreshForRequest("a")).toBe(false)
  expect(calls.a).toBe(2)
  tracker.stopAll()
})

test("a request refreshes only its own provider", async () => {
  const { tracker, calls, clientFor, advance } = tracked()
  tracker.startTracking("a", "A", clientFor("a"))
  tracker.startTracking("b", "B", clientFor("b"))
  await flush()
  advance(11_000)
  await tracker.refreshForRequest("a")
  expect(calls).toEqual({ a: 2, b: 1 })
  expect(await tracker.refreshForRequest("unknown")).toBe(false)
  tracker.stopAll()
})

test("idle providers are polled at 10x the interval, recently used ones every interval", async () => {
  const { tracker, calls, clientFor, advance } = tracked()
  tracker.startTracking("busy", "Busy", clientFor("busy"))
  tracker.startTracking("idle", "Idle", clientFor("idle"))
  await flush()
  advance(60_000)
  await tracker.refreshForRequest("busy")

  for (let i = 0; i < 10; i++) {
    advance(60_000)
    tracker.tick()
    await flush()
  }
  expect(calls.busy).toBe(1 + 1 + 10)
  expect(calls.idle).toBe(1 + 1)
  tracker.stopAll()
})

test("a provider falls back to the idle rate after the active window", async () => {
  const { tracker, calls, clientFor, advance } = tracked()
  tracker.startTracking("a", "A", clientFor("a"))
  await flush()
  advance(60_000)
  await tracker.refreshForRequest("a")
  advance(31 * 60_000)
  tracker.tick()
  await flush()
  expect(calls.a).toBe(3)
  advance(60_000)
  tracker.tick()
  await flush()
  expect(calls.a).toBe(3)
  tracker.stopAll()
})

test("one timer serves all providers and stopAll clears it", () => {
  const { tracker, clientFor } = tracked()
  expect(tracker.running).toBe(false)
  tracker.startTracking("a", "A", clientFor("a"))
  tracker.startTracking("b", "B", clientFor("b"))
  expect(tracker.running).toBe(true)
  tracker.stopTracking("a")
  expect(tracker.running).toBe(true)
  tracker.stopAll()
  expect(tracker.running).toBe(false)
})

test("failed fetches do not break polling", async () => {
  const { tracker, calls, clientFor, advance } = tracked({ fail: true })
  tracker.startTracking("a", "A", clientFor("a"))
  await flush()
  advance(60_000)
  await tracker.refreshForRequest("a")
  expect(calls.a).toBe(2)
  tracker.stopAll()
})
