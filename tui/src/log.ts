import fs from 'fs'
import path from 'path'
import { getLogDir } from './paths'

type Level = 'info' | 'warn' | 'error'

/**
 * File-based logger for TUI plugin
 * 
 * Writes logs to ~/.local/state/oclitellmac/log/YYYY-MM-DD-HH-mm-ss.log
 * Rotates log files every N log calls (default 500)
 * Falls back to console.error on write failures
 */
export class TuiLogger {
  private fd: number | null = null
  private count = 0
  private readonly rotateEvery: number

  constructor(rotateEvery = 500) {
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
      const dir = getLogDir()
      fs.mkdirSync(dir, { recursive: true })
      
      // Format: YYYY-MM-DD-HH-mm-ss.log
      const timestamp = new Date().toISOString()
        .replace('T', '-')
        .replace(/:/g, '-')
        .slice(0, 19)
      const filename = `${timestamp}.log`
      
      this.fd = fs.openSync(path.join(dir, filename), 'a')
    } catch (err) {
      console.error('[oclitellmac-tui] failed to open log file', err)
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
    
    console.error('[oclitellmac-tui]', line.trimEnd())
  }
}
