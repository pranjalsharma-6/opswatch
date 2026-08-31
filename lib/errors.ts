/**
 * Error type for missing/invalid configuration.
 *
 * Kept distinct from runtime failures so route handlers can return a 500 with
 * an actionable message ("set GROQ_API_KEY") instead of leaking a stack trace.
 */
export class ConfigError extends Error {
  readonly status = 500
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Error carrying an explicit HTTP status to surface to the client. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}
