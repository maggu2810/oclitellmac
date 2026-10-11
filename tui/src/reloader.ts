/**
 * Serialized, change-aware reloading
 *
 * At most one load is in flight. Requests arriving meanwhile collapse into
 * exactly one more load afterwards, so a slow older load can never overwrite
 * newer data. `apply` only runs when the loaded value differs (by JSON) from
 * the last applied one.
 */
export class Reloader<T> {
  private running = false
  private pending = false
  private stopped = false
  private current: Promise<void> = Promise.resolve()
  private last: string | undefined

  constructor(
    private load: () => Promise<T>,
    private apply: (value: T) => void,
    private onError: (error: unknown) => void = () => {},
  ) {}

  /**
   * Request a reload. The returned promise settles once the load that
   * covers this request has finished.
   */
  request(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.running) {
      this.pending = true
      return this.current
    }
    this.running = true
    this.current = this.run()
    return this.current
  }

  stop(): void {
    this.stopped = true
  }

  private async run(): Promise<void> {
    try {
      do {
        this.pending = false
        try {
          const value = await this.load()
          if (this.stopped) return
          const json = JSON.stringify(value)
          if (json !== this.last) {
            this.last = json
            this.apply(value)
          }
        } catch (error) {
          this.onError(error)
        }
      } while (this.pending && !this.stopped)
    } finally {
      this.running = false
    }
  }
}
