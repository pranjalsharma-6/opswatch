import { beforeEach, describe, expect, it } from 'vitest'
import { clientKey, pruneRateLimits, rateLimit, resetRateLimits } from '../lib/rate-limit'

beforeEach(() => resetRateLimits())

describe('rateLimit', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('a', 3, 60_000).allowed).toBe(true)
    }
    const blocked = rateLimit('a', 3, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('tracks each key independently', () => {
    rateLimit('a', 1, 60_000)
    expect(rateLimit('a', 1, 60_000).allowed).toBe(false)
    expect(rateLimit('b', 1, 60_000).allowed).toBe(true)
  })

  it('starts a fresh window after expiry', async () => {
    expect(rateLimit('a', 1, 10).allowed).toBe(true)
    expect(rateLimit('a', 1, 10).allowed).toBe(false)
    await new Promise((r) => setTimeout(r, 20))
    expect(rateLimit('a', 1, 10).allowed).toBe(true)
  })

  it('prunes expired windows so the map cannot grow without bound', async () => {
    rateLimit('a', 1, 5)
    await new Promise((r) => setTimeout(r, 15))
    pruneRateLimits()
    expect(rateLimit('a', 1, 60_000).remaining).toBe(0)
  })
})

describe('clientKey', () => {
  it('takes the first x-forwarded-for entry', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip then a shared bucket', () => {
    expect(clientKey(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
    expect(clientKey(new Headers())).toBe('unknown')
  })
})
