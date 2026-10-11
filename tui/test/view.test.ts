import { expect, test } from 'bun:test'
import type { BudgetData, ProviderBudget } from '../src/types'
import { parseMode, selectBudgets, showsHeader } from '../src/view'

function budget(providerKey: string): ProviderBudget {
  return {
    providerKey,
    providerName: providerKey.toUpperCase(),
    keyAlias: 'k',
    spend: 1,
    limit: 10,
    remaining: 9,
    percentUsed: 10,
    duration: null,
    resetAt: null,
    expiresAt: 'Never',
    lastFetched: 0,
  }
}

const data: BudgetData = { a: budget('a'), b: budget('b') }

test('parseMode accepts the four modes, trimmed and case-insensitive', () => {
  expect(parseMode('current')).toBe('current')
  expect(parseMode(' ALL ')).toBe('all')
  expect(parseMode('hidden')).toBe('hidden')
  expect(parseMode('masked')).toBe('masked')
})

test('parseMode rejects everything else', () => {
  expect(parseMode('')).toBeUndefined()
  expect(parseMode('none')).toBeUndefined()
  expect(parseMode(undefined)).toBeUndefined()
  expect(parseMode(5)).toBeUndefined()
})

test('all shows every budget regardless of model', () => {
  expect(selectBudgets('all', data, undefined).map((b) => b.providerKey)).toEqual(['a', 'b'])
  expect(selectBudgets('all', data, 'zzz')).toHaveLength(2)
})

test('current and masked show only the selected provider', () => {
  for (const mode of ['current', 'masked'] as const) {
    expect(selectBudgets(mode, data, 'b').map((b) => b.providerKey)).toEqual(['b'])
  }
})

test('current and masked are empty without a model or a budget file', () => {
  for (const mode of ['current', 'masked'] as const) {
    expect(selectBudgets(mode, data, undefined)).toEqual([])
    expect(selectBudgets(mode, data, 'unknown')).toEqual([])
    expect(selectBudgets(mode, {}, 'a')).toEqual([])
  }
})

test('hidden shows nothing', () => {
  expect(selectBudgets('hidden', data, 'a')).toEqual([])
})

test('header only in all and current', () => {
  expect(showsHeader('all')).toBe(true)
  expect(showsHeader('current')).toBe(true)
  expect(showsHeader('masked')).toBe(false)
  expect(showsHeader('hidden')).toBe(false)
})
