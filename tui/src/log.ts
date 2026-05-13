import fs from 'fs'
import path from 'path'

type Level = 'info' | 'warn' | 'error'

/**
 * File-based logger
 *
 * Writes logs to <logBaseDirectory>/<id>/YYYY-MM-DD-HH-mm-ss.log
 * Rotates log files every N log calls (default 500)
 * Falls back to console.error on write failures
 *
 * No dependency on project-specific path helpers — callers pass the base
 * directory so this module can be shared between server and TUI.
 */
export class Logger {
  private fd: number | null = null
  private count = 0
  private readonly logDir: string
  private readonly rotateEvery: number

  constructor(logBaseDirectory: string, id: string, rotateEvery = 500) {
    if (!id) {
      throw new Error('Logger id must not be empty')
    }
    this.logDir = path.join(logBaseDirectory, id)
    this.rotateEvery = rotateEvery
  }

  /**
   * Write a log entry
   * Automatically rotates to a new file every rotateEvery calls
   */
  log(level: Level, message: string): void {
    if (this.count % this.rotateEvery === 0) {
      this.rotate()
    }
    this.write(level, message)
    this.count++
  }

  /**
   * Close the logger and release file descriptor
   */
  close(): void {
    this.write('info', 'logger closing')
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd)
      } catch {
        // ignore close errors
      }
      this.fd = null
    }
  }

  /**
   * Rotate to a new log file
   * Closes current file (if open) and opens a new one with timestamp filename
   */
  private rotate(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd)
      } catch {
        // ignore close errors
      }
      this.fd = null
    }

    try {
      fs.mkdirSync(this.logDir, { recursive: true })

      // Format: YYYY-MM-DD-HH-mm-ss.log
      const timestamp = new Date().toISOString()
        .replace('T', '-')
        .replace(/:/g, '-')
        .slice(0, 19)
      const filename = `${timestamp}.log`

      this.fd = fs.openSync(path.join(this.logDir, filename), 'a')
    } catch (err) {
      console.error('[oclitellmac] failed to open log file', err)
    }
  }

  /**
   * Write a formatted log line
   * Falls back to console.error if file write fails
   */
  private write(level: Level, message: string): void {
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}\n`

    if (this.fd !== null) {
      try {
        fs.writeSync(this.fd, line)
        return
      } catch {
        // fall through to console fallback
      }
    }

    console.error('[oclitellmac]', line.trimEnd())
  }
}
