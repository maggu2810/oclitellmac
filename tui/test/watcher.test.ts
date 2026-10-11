import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { Logger } from '../src/log'
import { BudgetWatcher } from '../src/watcher'
import { sleep, tempDir, waitFor } from './helpers'

let tmp: Awaited<ReturnType<typeof tempDir>>
let logger: Logger
beforeEach(async () => {
  tmp = await tempDir()
  logger = new Logger(path.join(tmp.dir, 'logs'), 'tui', { level: 'error' })
})
afterEach(() => tmp.cleanup())

const keyInfo = () => path.join(tmp.dir, 'key-info')

test('debounce collapses a burst of writes into one callback', async () => {
  mkdirSync(keyInfo())
  let calls = 0
  const watcher = new BudgetWatcher(tmp.dir, () => calls++, logger, 1000, 80)
  watcher.start()
  try {
    for (let i = 0; i < 10; i++) {
      writeFileSync(path.join(keyInfo(), `p${i % 3}.json`), String(i))
      await sleep(5)
    }
    expect(calls).toBe(0)
    expect(await waitFor(() => calls > 0)).toBe(true)
    await sleep(200)
    expect(calls).toBe(1)
  } finally {
    watcher.stop()
  }
})

test('non-json files do not trigger the callback', async () => {
  mkdirSync(keyInfo())
  let calls = 0
  const watcher = new BudgetWatcher(tmp.dir, () => calls++, logger, 1000, 30)
  watcher.start()
  try {
    writeFileSync(path.join(keyInfo(), 'x.tmp'), '1')
    await sleep(150)
    expect(calls).toBe(0)
  } finally {
    watcher.stop()
  }
})

test('starts with a missing directory, then switches to fs.watch once it exists', async () => {
  let calls = 0
  const watcher = new BudgetWatcher(tmp.dir, () => calls++, logger, 40, 20)
  watcher.start()
  try {
    mkdirSync(keyInfo())
    // the first poll tick after creation triggers a callback and installs fs.watch
    expect(await waitFor(() => calls > 0)).toBe(true)
    await sleep(120)
    const settled = calls

    // polling must have stopped: without writes nothing fires any more
    await sleep(200)
    expect(calls).toBe(settled)

    // and fs.watch is live
    writeFileSync(path.join(keyInfo(), 'p.json'), '{}')
    expect(await waitFor(() => calls > settled)).toBe(true)
  } finally {
    watcher.stop()
  }
})

test('stop leaves no active timers and is idempotent', async () => {
  let calls = 0
  for (let i = 0; i < 20; i++) {
    const watcher = new BudgetWatcher(tmp.dir, () => calls++, logger, 10, 10)
    watcher.start()
    watcher.start()
    watcher.stop()
    watcher.stop()
  }
  mkdirSync(keyInfo())
  for (let i = 0; i < 20; i++) {
    const watcher = new BudgetWatcher(tmp.dir, () => calls++, logger, 10, 10)
    watcher.start()
    writeFileSync(path.join(keyInfo(), 'p.json'), String(i))
    watcher.stop()
  }
  await sleep(150)
  expect(calls).toBe(0)
})

test('the process exits on its own when watchers were stopped', async () => {
  const script = `
    import { BudgetWatcher } from ${JSON.stringify(path.resolve(import.meta.dir, '../src/watcher'))}
    import { Logger } from ${JSON.stringify(path.resolve(import.meta.dir, '../src/log'))}
    const logger = new Logger(${JSON.stringify(path.join(tmp.dir, 'logs'))}, 'tui', { level: 'error' })
    for (let i = 0; i < 5; i++) {
      const w = new BudgetWatcher(${JSON.stringify(tmp.dir)}, () => {}, logger, 20, 20)
      w.start()
      w.stop()
    }
  `
  const proc = Bun.spawn(['bun', '-e', script], { stdout: 'ignore', stderr: 'pipe' })
  const timeout = setTimeout(() => proc.kill(), 5000)
  const code = await proc.exited
  clearTimeout(timeout)
  expect(code).toBe(0)
})
