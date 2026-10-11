import { afterEach, beforeEach, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { BudgetLoader } from '../src/loader'
import { Logger } from '../src/log'
import { tempDir } from './helpers'

let tmp: Awaited<ReturnType<typeof tempDir>>
let keyInfo: string
beforeEach(async () => {
  tmp = await tempDir()
  keyInfo = path.join(tmp.dir, 'key-info')
  mkdirSync(keyInfo)
})
afterEach(() => tmp.cleanup())

function write(key: string, info: Record<string, unknown> | null, extra: Record<string, unknown> = {}) {
  const body = info === null ? 'not json{' : JSON.stringify({
    providerKey: key,
    fetchedAt: 1700000000000,
    keyInfo: { key: 'redacted', info },
    ...extra,
  })
  writeFileSync(path.join(keyInfo, `${key}.json`), body)
}

function loader(level: 'warn' | 'debug' = 'warn') {
  const logs = path.join(tmp.dir, 'logs')
  return { loader: new BudgetLoader(new Logger(logs, 'tui', { level }), keyInfo), logs }
}

test('valid file with a limit', async () => {
  write('p', { key_alias: 'alias', spend: 25, max_budget: 100, budget_duration: '30d', budget_reset_at: '2030-01-01T00:00:00Z' })
  const { loader: l } = loader()
  const budget = await l.loadOne('p')
  expect(budget).toMatchObject({
    providerKey: 'p',
    providerName: 'P',
    keyAlias: 'alias',
    spend: 25,
    limit: 100,
    remaining: 75,
    percentUsed: 25,
    duration: '30d',
    resetAt: '2030-01-01T00:00:00Z',
    expiresAt: 'Never',
    lastFetched: 1700000000000,
  })
})

test('missing, null and undefined max_budget mean no limit', async () => {
  write('a', { spend: 3, max_budget: null })
  write('b', { spend: 3 })
  const { loader: l } = loader()
  for (const key of ['a', 'b']) {
    expect(await l.loadOne(key)).toMatchObject({ spend: 3, limit: null, remaining: null, percentUsed: null, duration: null, resetAt: null })
  }
})

test('zero max_budget is treated as no usable limit', async () => {
  write('z', { spend: 3, max_budget: 0 })
  const { loader: l } = loader()
  const budget = await l.loadOne('z')
  expect(budget).toMatchObject({ limit: null, remaining: null, percentUsed: null })
})

test('invalid files return null: bad json, missing spend, non-numeric spend or max_budget', async () => {
  write('json', null)
  write('nospend', { max_budget: 5 })
  write('strspend', { spend: '5', max_budget: 5 })
  write('strmax', { spend: 5, max_budget: '5' })
  writeFileSync(path.join(keyInfo, 'noinfo.json'), JSON.stringify({ providerKey: 'noinfo', fetchedAt: 1 }))
  const { loader: l } = loader()
  for (const key of ['json', 'nospend', 'strspend', 'strmax', 'noinfo', 'missing']) {
    expect(await l.loadOne(key)).toBeNull()
  }
})

test('loadAll counts errors, keeps valid files and orders by name then key', async () => {
  write('zeta', { spend: 1, max_budget: 2 }, { providerName: 'Alpha' })
  write('beta', { spend: 1, max_budget: 2 }, { providerName: 'Beta' })
  write('alpha', { spend: 1, max_budget: 2 }, { providerName: 'Alpha' })
  write('broken', { spend: 'x' })
  const { loader: l } = loader()
  const result = await l.loadAll()
  expect(result.hasErrors).toBe(true)
  expect(result.errorCount).toBe(1)
  expect(Object.keys(result.budgets)).toEqual(['alpha', 'zeta', 'beta'])
})

test('loadAll with a missing directory is empty and not an error', async () => {
  const l = new BudgetLoader(new Logger(path.join(tmp.dir, 'logs'), 'tui'), path.join(tmp.dir, 'nope'))
  expect(await l.loadAll()).toEqual({ budgets: {}, hasErrors: false, errorCount: 0 })
})

test('an invalid file is logged once per content change, not per reload', async () => {
  write('bad', { spend: 'x' })
  const { loader: l, logs } = loader()
  for (let i = 0; i < 5; i++) await l.loadAll()
  const read = () => {
    const dir = path.join(logs, 'tui')
    return readdirSync(dir).map((f: string) => readFileSync(path.join(dir, f), 'utf-8')).join('')
  }
  expect(read().match(/Invalid budget data for bad/g)).toHaveLength(1)

  write('bad', { spend: 1, max_budget: 'z' })
  await l.loadAll()
  await l.loadAll()
  expect(read().match(/\[WARN\]/g)).toHaveLength(2)

  write('bad', { spend: 1, max_budget: 2 })
  expect((await l.loadAll()).hasErrors).toBe(false)
  write('bad', { spend: 'x' })
  await l.loadAll()
  expect(read().match(/\[WARN\]/g)).toHaveLength(3)
})

test('reloads of valid files write nothing at the default level', async () => {
  write('p', { spend: 1, max_budget: 2 })
  const { loader: l, logs } = loader()
  await l.loadAll()
  await l.loadAll()
  expect(existsSync(logs)).toBe(false)
})
