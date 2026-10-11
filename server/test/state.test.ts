import { afterEach, beforeEach, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "fs/promises"
import path from "path"
import { StateManager } from "../src/state"

let root: string
let state: StateManager

beforeEach(async () => {
  await mkdir("/tmp/opencode", { recursive: true })
  root = await mkdtemp(path.join("/tmp/opencode", "oclitellmac-state-"))
  state = new StateManager(path.join(root, "providers"), path.join(root, "key-info"))
  await state.ensureDirectories()
})

afterEach(() => rm(root, { recursive: true, force: true }))

const mode = async (file: string) => (await stat(file)).mode & 0o777

test("directories are created with mode 0700", async () => {
  expect(await mode(state.getProviderCacheDir())).toBe(0o700)
  expect(await mode(state.getBudgetDataDir())).toBe(0o700)
})

test("state files are written with mode 0600 and can be read back", async () => {
  await state.saveBudgetData("p", { spend: 1 })
  await state.saveProviderCache("p", { models: {} })
  expect(await mode(path.join(state.getBudgetDataDir(), "p.json"))).toBe(0o600)
  expect(await mode(path.join(state.getProviderCacheDir(), "p.json"))).toBe(0o600)
  expect(await state.loadBudgetData("p")).toEqual({ spend: 1 })
  expect(await state.loadProviderCache("p")).toEqual({ models: {} })
})

test("overwriting a world-readable file ends up 0600", async () => {
  for (const [dir, save] of [
    [state.getBudgetDataDir(), (d: unknown) => state.saveBudgetData("p", d)],
    [state.getProviderCacheDir(), (d: unknown) => state.saveProviderCache("p", d)],
  ] as const) {
    const file = path.join(dir, "p.json")
    await writeFile(file, "{}")
    await chmod(file, 0o644)
    await save({ spend: 2 })
    expect(await mode(file)).toBe(0o600)
  }
})

test("atomic writes leave no temp files, also under concurrency", async () => {
  await Promise.all([1, 2, 3, 4, 5].map((spend) => state.saveBudgetData("p", { spend })))
  expect(await readdir(state.getBudgetDataDir())).toEqual(["p.json"])
  expect(typeof (await state.loadBudgetData("p")).spend).toBe("number")
})

test("default directories follow the XDG state path", () => {
  expect(new StateManager().getBudgetDataDir().endsWith(path.join("oclitellmac", "key-info"))).toBe(true)
})
