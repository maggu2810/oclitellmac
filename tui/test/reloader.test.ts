import { expect, test } from 'bun:test'
import { Reloader } from '../src/reloader'
import { sleep } from './helpers'

test('serializes loads and runs exactly one more after a burst', async () => {
  let inFlight = 0
  let maxInFlight = 0
  let loads = 0
  const applied: number[] = []
  const reloader = new Reloader(
    async () => {
      const n = ++loads
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await sleep(30)
      inFlight--
      return n
    },
    (value) => applied.push(value),
  )
  const first = reloader.request()
  await sleep(5)
  reloader.request()
  reloader.request()
  const last = reloader.request()
  await Promise.all([first, last])
  expect(maxInFlight).toBe(1)
  expect(loads).toBe(2)
  expect(applied).toEqual([1, 2])
})

test('apply only runs when the content changed', async () => {
  const applied: unknown[] = []
  const reloader = new Reloader(async () => ({ a: 1 }), (v) => applied.push(v))
  await reloader.request()
  await reloader.request()
  await reloader.request()
  expect(applied).toEqual([{ a: 1 }])
})

test('errors are reported and the next request still works', async () => {
  const errors: unknown[] = []
  let fail = true
  const applied: number[] = []
  const reloader = new Reloader(
    async () => {
      if (fail) throw new Error('boom')
      return 1
    },
    (v) => applied.push(v),
    (e) => errors.push(e),
  )
  await reloader.request()
  fail = false
  await reloader.request()
  expect(errors).toHaveLength(1)
  expect(applied).toEqual([1])
})

test('nothing is applied after stop', async () => {
  const applied: number[] = []
  const reloader = new Reloader(async () => { await sleep(20); return 1 }, (v) => applied.push(v))
  const pending = reloader.request()
  reloader.stop()
  await pending
  await reloader.request()
  expect(applied).toEqual([])
})
