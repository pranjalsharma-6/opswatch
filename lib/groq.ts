import Groq from 'groq-sdk'
import { optionalEnv, requireEnv } from './env'

/**
 * Models tried in order, most capable first.
 *
 * Groq retires hosted models on a rolling basis, and a retired id fails with a
 * 404 that previously took the whole feature down until the id was edited by
 * hand. The chain plus GROQ_MODEL means a retirement degrades to the next
 * model instead of an outage.
 */
export const DEFAULT_MODEL_CHAIN = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant',
] as const

export function getModelChain(): string[] {
  const override = optionalEnv('GROQ_MODEL')
  if (!override) return [...DEFAULT_MODEL_CHAIN]
  // Keep the defaults as fallbacks behind an explicit override.
  return [override, ...DEFAULT_MODEL_CHAIN.filter((m) => m !== override)]
}

let cached: Groq | null = null

/**
 * Returns a lazily constructed Groq client.
 *
 * The client MUST NOT be built at module scope: the constructor throws when
 * GROQ_API_KEY is absent, and a module-scope throw fails `next build` during
 * page-data collection instead of producing a request-time error.
 */
export function getGroqClient(): Groq {
  if (!cached) {
    cached = new Groq({ apiKey: requireEnv('GROQ_API_KEY') })
  }
  return cached
}

/** Test seam: clears the cached client so env changes take effect. */
export function resetGroqClient(): void {
  cached = null
}

/** True when the error indicates the model id is unknown or retired. */
export function isModelUnavailableError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (status === 404) return true
  if (status === 400 && message.includes('model')) return true
  return (
    message.includes('does not exist') ||
    message.includes('decommission') ||
    message.includes('has been deprecated')
  )
}
