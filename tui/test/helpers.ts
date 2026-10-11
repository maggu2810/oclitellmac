import { mkdtemp, rm } from 'fs/promises'
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'

export async function tempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  mkdirSync('/tmp/opencode', { recursive: true })
  const base = os.tmpdir() === '/tmp' ? '/tmp/opencode' : os.tmpdir()
  const dir = await mkdtemp(path.join(base, 'oclitellmac-tui-'))
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function waitFor(check: () => boolean, timeoutMs = 1500): Promise<boolean> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (check()) return true
    await sleep(10)
  }
  return check()
}
