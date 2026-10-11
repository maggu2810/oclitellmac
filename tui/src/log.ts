import fs from 'fs'
import path from 'path'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug']
export const DEFAULT_LOG_LEVEL: LogLevel = 'warn'

const SEVERITY: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }
const LOG_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.log$/

export function parseLogLevel(value: unknown, fallback: LogLevel = DEFAULT_LOG_LEVEL): LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value)
    ? (value as LogLevel)
    : fallback
}

export interface LoggerOptions {
  /** Messages less severe than this are dropped. Default: warn */
  level?: LogLevel
  /** Start a new file once the current one would exceed this size. Default: 1 MiB */
  maxBytes?: number
  /** Maximum number of log files kept in the directory. Default: 5 */
  maxFiles?: number
}

/**
 * File-based logger
 *
 * Writes logs to <logBaseDirectory>/<id>/YYYY-MM-DD-HH-mm-ss.log. The file is
 * created lazily on the first message that passes the level filter, appended
 * to for the whole session and rotated by size. Only files matching the
 * timestamp pattern are ever deleted, and only to stay within maxFiles.
 * Falls back to console.error on write failures.
 *
 * No dependency on project-specific path helpers — callers pass the base
 * directory so this module can be shared between server and TUI.
 */
export class Logger {
  private fd: number | null = null
  private bytes = 0
  private openFailed = false
  private readonly logDir: string
  private readonly threshold: number
  private readonly maxBytes: number
  private readonly maxFiles: number

  constructor(logBaseDirectory: string, id: string, options: LoggerOptions = {}) {
    if (!id) {
      throw new Error('Logger id must not be empty')
    }
    this.logDir = path.join(logBaseDirectory, id)
    this.threshold = SEVERITY[options.level ?? DEFAULT_LOG_LEVEL]
    this.maxBytes = options.maxBytes ?? 1024 * 1024
    this.maxFiles = options.maxFiles ?? 5
    this.prune()
  }

  /**
   * Whether a message of this level would be written
   */
  enabled(level: LogLevel): boolean {
    return SEVERITY[level] <= this.threshold
  }

  /**
   * Write a log entry if its level passes the filter
   */
  log(level: LogLevel, message: string): void {
    if (!this.enabled(level)) return

    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}\n`
    const size = Buffer.byteLength(line)

    if (this.fd !== null && this.bytes > 0 && this.bytes + size > this.maxBytes) {
      this.closeFile()
    }
    if (this.fd === null && !this.openFailed) {
      this.open()
    }

    if (this.fd !== null) {
      try {
        fs.writeSync(this.fd, line)
        this.bytes += size
        return
      } catch {
        // fall through to console fallback
      }
    }

    console.error('[oclitellmac]', line.trimEnd())
  }

  /**
   * Close the logger and release file descriptor
   */
  close(): void {
    this.closeFile()
  }

  private closeFile(): void {
    if (this.fd === null) return
    try {
      fs.closeSync(this.fd)
    } catch {
      // ignore close errors
    }
    this.fd = null
    this.bytes = 0
  }

  /**
   * Open a new, unique log file named after the current time
   */
  private open(): void {
    try {
      fs.mkdirSync(this.logDir, { recursive: true })

      const time = Date.now()
      for (let attempt = 0; attempt < 1000; attempt++) {
        // Format: YYYY-MM-DD-HH-mm-ss.log (bumped by a second on collision)
        const timestamp = new Date(time + attempt * 1000).toISOString()
          .replace('T', '-')
          .replace(/:/g, '-')
          .slice(0, 19)
        try {
          this.fd = fs.openSync(path.join(this.logDir, `${timestamp}.log`), 'wx')
          this.bytes = 0
          this.prune()
          return
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        }
      }
      throw new Error('no free log file name')
    } catch (err) {
      this.openFailed = true
      console.error('[oclitellmac] failed to open log file', err)
    }
  }

  /**
   * Delete the oldest timestamp-named log files beyond maxFiles
   */
  private prune(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter((name) => LOG_FILE_PATTERN.test(name))
        .sort()
      for (const name of files.slice(0, Math.max(0, files.length - this.maxFiles))) {
        try {
          fs.unlinkSync(path.join(this.logDir, name))
        } catch {
          // ignore delete errors
        }
      }
    } catch {
      // directory does not exist yet
    }
  }
}
