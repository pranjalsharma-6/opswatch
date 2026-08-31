import { ConfigError } from './errors'

/**
 * Reads a required environment variable at call time.
 *
 * Deliberately NOT evaluated at module scope: doing so crashes the route
 * module during `next build` page-data collection, which fails the whole build
 * rather than returning a useful error at request time.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new ConfigError(
      `${name} is not set. Add it to .env.local (local) or your Vercel project settings (deployed).`
    )
  }
  return value.trim()
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}
