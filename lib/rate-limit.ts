/**
 * Fixed-window in-memory rate limiter.
 *
 * Scoped to a single server instance, so on serverless platforms each cold
 * instance carries its own counter and the effective global limit is higher
 * than the configured one. That is acceptable here: the goal is to stop one
 * client from trivially draining the Groq quota, not to enforce a hard quota.
 * A durable limiter (Upstash Redis, or Postgres) would be the next step.
 */
type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = windows.get(key)

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds }
}

/** Removes expired windows so the map does not grow without bound. */
export function pruneRateLimits(now: number = Date.now()): void {
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key)
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear()
}

/** Best-effort client identity from proxy headers, falling back to a shared bucket. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
