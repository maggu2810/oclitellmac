import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises"
import path from "path"
import { getProviderCacheDir, getBudgetDataDir } from "./paths"

/**
 * State manager with file locking to prevent concurrent write collisions
 */
export class StateManager {
  private providerCacheDir: string
  private budgetDataDir: string
  private locks = new Map<string, Promise<void>>()
  
  constructor(providerCacheDir = getProviderCacheDir(), budgetDataDir = getBudgetDataDir()) {
    this.providerCacheDir = providerCacheDir
    this.budgetDataDir = budgetDataDir
  }
  
  /**
   * Ensure state directories exist
   */
  async ensureDirectories(): Promise<void> {
    await mkdir(this.providerCacheDir, { recursive: true, mode: 0o700 })
    await mkdir(this.budgetDataDir, { recursive: true, mode: 0o700 })
  }
  
  /**
   * Acquire a lock for a specific file path to prevent concurrent writes
   */
  private async withLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing operation on this key
    while (this.locks.has(lockKey)) {
      await this.locks.get(lockKey)
    }
    
    // Create new lock
    let resolveLock: () => void
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve
    })
    this.locks.set(lockKey, lockPromise)
    
    try {
      return await fn()
    } finally {
      // Release lock
      this.locks.delete(lockKey)
      resolveLock!()
    }
  }
  
  /**
   * Write a private file atomically (temp file in the same directory, then rename)
   */
  private async writePrivate(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.${process.pid}.tmp`
    try {
      await writeFile(tmpPath, content, { encoding: "utf-8", mode: 0o600 })
      await rename(tmpPath, filePath)
    } catch (error) {
      await unlink(tmpPath).catch(() => {})
      throw error
    }
  }

  /**
   * Save provider cache with atomic write
   */
  async saveProviderCache(providerKey: string, data: any): Promise<void> {
    return this.withLock(`provider:${providerKey}`, async () => {
      const filePath = path.join(this.providerCacheDir, `${providerKey}.json`)
      const content = JSON.stringify(data, null, 2)
      await this.writePrivate(filePath, content)
    })
  }
  
  /**
   * Load provider cache
   */
  async loadProviderCache(providerKey: string): Promise<any | null> {
    const filePath = path.join(this.providerCacheDir, `${providerKey}.json`)
    try {
      const content = await readFile(filePath, "utf-8")
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  
  /**
   * Save budget data with atomic write and collision prevention
   */
  async saveBudgetData(providerKey: string, data: any): Promise<void> {
    return this.withLock(`budget:${providerKey}`, async () => {
      const filePath = path.join(this.budgetDataDir, `${providerKey}.json`)
      const content = JSON.stringify(data, null, 2)
      await this.writePrivate(filePath, content)
    })
  }
  
  /**
   * Load budget data
   */
  async loadBudgetData(providerKey: string): Promise<any | null> {
    const filePath = path.join(this.budgetDataDir, `${providerKey}.json`)
    try {
      const content = await readFile(filePath, "utf-8")
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  
  /**
   * Get provider cache directory path
   */
  getProviderCacheDir(): string {
    return this.providerCacheDir
  }
  
  /**
   * Get budget data directory path
   */
  getBudgetDataDir(): string {
    return this.budgetDataDir
  }
}
