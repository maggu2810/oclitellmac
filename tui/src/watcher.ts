import { watch } from 'fs'
import type { FSWatcher } from 'fs'
import path from 'path'
import type { Logger } from './log'

/**
 * File watcher for budget data files
 *
 * Watches ~/.local/state/oclitellmac/key-info/ for changes and calls onChange
 * once a burst of events has settled (trailing debounce).
 *
 * fs.watch and polling are never active together: while fs.watch is not
 * available (directory missing, watcher error) the directory is polled and
 * every poll retries fs.watch; the first success ends polling.
 */
export class BudgetWatcher {
  private watcher: FSWatcher | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private stateDir: string,
    private onChange: () => void,
    private logger: Logger,
    private pollInterval: number = 5000,
    private debounceMs: number = 150,
  ) {}

  /**
   * Start watching for file changes
   */
  start(): void {
    if (this.running) return
    this.running = true
    this.logger.log('info', `watcher.start: stateDir=${this.stateDir}`)

    if (!this.tryWatch()) {
      this.startPolling()
    }
  }

  /**
   * Stop watching. Safe to call repeatedly; no timer survives it.
   */
  stop(): void {
    if (this.running) this.logger.log('info', 'watcher.stop')
    this.running = false
    this.closeWatcher()
    this.stopPolling()
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  private tryWatch(): boolean {
    const keyInfoDir = path.join(this.stateDir, 'key-info')
    try {
      const watcher = watch(keyInfoDir, { recursive: false }, (_eventType, filename) => {
        if (filename && String(filename).endsWith('.json')) {
          this.schedule()
        }
      })
      watcher.on('error', (error) => {
        if (this.watcher !== watcher) return
        this.logger.log('warn', `watcher: fs.watch failed, falling back to polling: ${error}`)
        this.closeWatcher()
        if (this.running) {
          this.startPolling()
          this.schedule()
        }
      })
      this.watcher = watcher
      this.logger.log('info', 'watcher: fs.watch started')
      return true
    } catch (error) {
      this.logger.log('debug', `watcher: fs.watch unavailable: ${error}`)
      return false
    }
  }

  private closeWatcher(): void {
    if (!this.watcher) return
    const watcher = this.watcher
    this.watcher = null
    try {
      watcher.close()
    } catch {
      // ignore close errors
    }
  }

  private startPolling(): void {
    if (this.pollTimer || !this.running) return
    this.logger.log('info', `watcher: polling every ${this.pollInterval}ms until fs.watch is available`)
    this.pollTimer = setInterval(() => {
      if (this.tryWatch()) {
        this.stopPolling()
      }
      this.schedule()
    }, this.pollInterval)
  }

  private stopPolling(): void {
    if (!this.pollTimer) return
    clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  private schedule(): void {
    if (!this.running) return
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      if (this.running) this.onChange()
    }, this.debounceMs)
  }
}
