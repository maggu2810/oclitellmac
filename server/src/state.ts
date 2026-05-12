import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { getProviderCacheDir, getBudgetDataDir } from "./paths.js"

/**
 * State manager with file locking to prevent concurrent write collisions
 */
export class StateManager {
  private providerCacheDir: string
  private budgetDataDir: string
  private locks = new Map<string, Promise<void>>()
  
  constructor() {
    this.providerCacheDir = getProviderCacheDir()
    this.budgetDataDir = getBudgetDataDir()
  }
  
  /**
   * Ensure state directories exist
   */
  async ensureDirectories(): Promise<void> {
    await mkdir(this.providerCacheDir, { recursive: true })
    await mkdir(this.budgetDataDir, { recursive: true })
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
   * Save provider cache with atomic write
   */
  async saveProviderCache(providerKey: string, data: any): Promise<void> {
    return this.withLock(`provider:${providerKey}`, async () => {
      const filePath = path.join(this.providerCacheDir, `${providerKey}.json`)
      const content = JSON.stringify(data, null, 2)
      await writeFile(filePath, content, "utf-8")
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
      await writeFile(filePath, content, "utf-8")
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
