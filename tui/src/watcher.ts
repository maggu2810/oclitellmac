import { watch } from 'fs'
import type { FSWatcher } from 'fs'
import path from 'path'

/**
 * File watcher for budget data files
 * 
 * Watches ~/.local/state/oclitellmac/key-info/ directory for changes
 * and triggers callback when budget files are updated.
 */
export class BudgetWatcher {
  private watcher: FSWatcher | null = null
  private pollTimer: NodeJS.Timeout | null = null

  constructor(
    private stateDir: string,
    private onChange: () => void,
    private pollInterval: number = 5000, // 5 seconds fallback polling
  ) {}

  /**
   * Start watching for file changes
   */
  start(): void {
    const keyInfoDir = path.join(this.stateDir, 'key-info')

    try {
      // Try native file watching first (more efficient)
      this.watcher = watch(keyInfoDir, { recursive: false }, (eventType, filename) => {
        // Only react to JSON file changes
        if (filename && filename.endsWith('.json')) {
          this.onChange()
        }
      })
    } catch (error) {
      // Fallback to polling if fs.watch not supported or directory doesn't exist
      this.startPolling()
    }
  }

  /**
   * Start polling as fallback when fs.watch is not available
   */
  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.onChange()
    }, this.pollInterval)
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}
