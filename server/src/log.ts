import { appendFile, rename, stat } from "fs/promises"

/** Append-only log file that moves itself to `<file>.1` once it exceeds `maxBytes`. */
export class RotatingLog {
  private size: number | undefined
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private file: string,
    private maxBytes: number,
  ) {}

  append(line: string): Promise<void> {
    this.queue = this.queue.then(() => this.write(`${line}\n`)).catch(() => {})
    return this.queue
  }

  private async write(text: string): Promise<void> {
    if (this.size === undefined) this.size = await stat(this.file).then((info) => info.size, () => 0)
    if (this.size > this.maxBytes) {
      await rename(this.file, `${this.file}.1`)
      this.size = 0
    }
    await appendFile(this.file, text, { mode: 0o600 })
    this.size += Buffer.byteLength(text)
  }
}
