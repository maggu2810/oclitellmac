import { afterEach, beforeEach, expect, test } from 'bun:test'
import { writeFileSync } from 'fs'
import path from 'path'
import { loadTuiSettings } from '../src/config'
import { getConfigPath } from '../src/paths'
import { tempDir } from './helpers'

let tmp: Awaited<ReturnType<typeof tempDir>>
beforeEach(async () => {
  tmp = await tempDir()
})
afterEach(() => tmp.cleanup())

const defaults = { logLevel: 'warn', sidebarMode: 'current' }

function config(content: string) {
  const file = path.join(tmp.dir, 'server.json')
  writeFileSync(file, content)
  return file
}

test('config path ends with oclitellmac/server.json', () => {
  expect(getConfigPath().endsWith(path.join('oclitellmac', 'server.json'))).toBe(true)
})

test('defaults for a missing file, invalid JSON and missing keys', () => {
  expect(loadTuiSettings(path.join(tmp.dir, 'none.json'))).toEqual(defaults as never)
  expect(loadTuiSettings(config('{nope'))).toEqual(defaults as never)
  expect(loadTuiSettings(config('{"endpoints":[]}'))).toEqual(defaults as never)
  expect(loadTuiSettings(config('null'))).toEqual(defaults as never)
})

test('reads valid values and falls back per key for invalid ones', () => {
  expect(loadTuiSettings(config('{"options":{"tui":{"logLevel":"debug","sidebarMode":"masked"}}}'))).toEqual({
    logLevel: 'debug',
    sidebarMode: 'masked',
  })
  expect(loadTuiSettings(config('{"options":{"tui":{"logLevel":"loud","sidebarMode":"all"}}}'))).toEqual({
    logLevel: 'warn',
    sidebarMode: 'all',
  })
})
