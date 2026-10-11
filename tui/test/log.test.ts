import { afterEach, beforeEach, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { Logger, parseLogLevel } from '../src/log'
import { tempDir } from './helpers'

let tmp: Awaited<ReturnType<typeof tempDir>>
beforeEach(async () => {
  tmp = await tempDir()
})
afterEach(() => tmp.cleanup())

const logDir = () => path.join(tmp.dir, 'tui')
const files = () => readdirSync(logDir()).sort()

test('parseLogLevel accepts the four levels and falls back otherwise', () => {
  for (const level of ['error', 'warn', 'info', 'debug']) expect(parseLogLevel(level)).toBe(level as never)
  expect(parseLogLevel('verbose')).toBe('warn')
  expect(parseLogLevel(undefined)).toBe('warn')
  expect(parseLogLevel(3, 'info')).toBe('info')
})

test('default level is warn and drops info/debug', () => {
  const logger = new Logger(tmp.dir, 'tui')
  logger.log('debug', 'd')
  logger.log('info', 'i')
  expect(existsSync(logDir())).toBe(false)
  logger.log('warn', 'w')
  logger.log('error', 'e')
  logger.close()
  const text = readFileSync(path.join(logDir(), files()[0]!), 'utf-8')
  expect(text).toContain('[WARN] w')
  expect(text).toContain('[ERROR] e')
  expect(text).not.toContain('[INFO]')
  expect(text).not.toContain('[DEBUG]')
})

test('debug level writes everything; error level only errors', () => {
  const all = new Logger(tmp.dir, 'all', { level: 'debug' })
  for (const level of ['debug', 'info', 'warn', 'error'] as const) all.log(level, level)
  all.close()
  const allText = readFileSync(path.join(tmp.dir, 'all', readdirSync(path.join(tmp.dir, 'all'))[0]!), 'utf-8')
  expect(allText.trim().split('\n')).toHaveLength(4)

  const errors = new Logger(tmp.dir, 'err', { level: 'error' })
  errors.log('warn', 'w')
  errors.log('error', 'e')
  errors.close()
  const errText = readFileSync(path.join(tmp.dir, 'err', readdirSync(path.join(tmp.dir, 'err'))[0]!), 'utf-8')
  expect(errText.trim().split('\n')).toHaveLength(1)
})

test('an idle logger creates no files or directories, even when closed', () => {
  const logger = new Logger(tmp.dir, 'tui', { level: 'debug' })
  logger.close()
  expect(existsSync(logDir())).toBe(false)
})

test('one file per session, appended to', () => {
  const logger = new Logger(tmp.dir, 'tui')
  for (let i = 0; i < 50; i++) logger.log('warn', `line ${i}`)
  logger.close()
  expect(files()).toHaveLength(1)
  expect(readFileSync(path.join(logDir(), files()[0]!), 'utf-8').trim().split('\n')).toHaveLength(50)
})

test('rotates by size', () => {
  const logger = new Logger(tmp.dir, 'tui', { maxBytes: 600, maxFiles: 100 })
  for (let i = 0; i < 20; i++) logger.log('warn', 'x'.repeat(80))
  logger.close()
  const names = files()
  expect(names.length).toBeGreaterThan(1)
  for (const name of names) {
    expect(readFileSync(path.join(logDir(), name)).length).toBeLessThanOrEqual(600)
  }
})

test('keeps at most 5 log files and only deletes pattern-matching ones', () => {
  mkdirSync(logDir(), { recursive: true })
  const old = [1, 2, 3, 4, 5, 6, 7].map((n) => `2020-01-0${n}-00-00-00.log`)
  for (const name of old) writeFileSync(path.join(logDir(), name), 'old\n')
  writeFileSync(path.join(logDir(), 'notes.txt'), 'keep')
  writeFileSync(path.join(logDir(), 'other.log'), 'keep')

  const logger = new Logger(tmp.dir, 'tui')
  // startup trims to the limit before anything is written
  expect(files().filter((n) => /^\d{4}-/.test(n))).toEqual(old.slice(2))

  logger.log('warn', 'first')
  logger.close()
  const stamped = files().filter((n) => /^\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.log$/.test(n))
  expect(stamped).toHaveLength(5)
  expect(stamped).not.toContain(old[2]!)
  expect(stamped).toContain(old[6]!)
  expect(files()).toContain('notes.txt')
  expect(files()).toContain('other.log')
})
