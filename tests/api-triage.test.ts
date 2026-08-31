import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createCompletion = vi.fn()

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = { completions: { create: createCompletion } }
    constructor(opts: { apiKey?: string }) {
      if (!opts.apiKey) throw new Error('missing key')
    }
  },
}))

import { POST } from '../app/api/triage/route'
import { resetGroqClient } from '../lib/groq'
import { resetRateLimits } from '../lib/rate-limit'

function post(body: unknown, ip = '10.0.0.1') {
  return new Request('http://localhost/api/triage', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as never
}

function completion(content: string) {
  return { choices: [{ message: { content } }] }
}

const VALID = JSON.stringify({
  severity: 'critical',
  title: 'OOMKilled',
  root_cause: 'memory limit exceeded',
  impact: 'API down',
  fix: '1. Raise limit\n2. Redeploy',
  component: 'api-server',
})

beforeEach(() => {
  createCompletion.mockReset()
  resetRateLimits()
  resetGroqClient()
  process.env.GROQ_API_KEY = 'test-key'
})

afterEach(() => {
  delete process.env.GROQ_API_KEY
  delete process.env.GROQ_MODEL
})

describe('POST /api/triage', () => {
  it('returns a triaged incident on success', async () => {
    createCompletion.mockResolvedValue(completion(VALID))
    const res = await POST(post({ logs: '[ERROR] OOMKilled' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      severity: 'critical',
      component: 'api-server',
      fix: '1. Raise limit\n2. Redeploy',
    })
  })

  it('rejects empty logs before calling the model', async () => {
    const res = await POST(post({ logs: '  ' }))
    expect(res.status).toBe(400)
    expect(createCompletion).not.toHaveBeenCalled()
  })

  it('rejects oversized logs before calling the model', async () => {
    const res = await POST(post({ logs: 'x'.repeat(50_000) }))
    expect(res.status).toBe(400)
    expect(createCompletion).not.toHaveBeenCalled()
  })

  it('returns an actionable error when the API key is missing', async () => {
    delete process.env.GROQ_API_KEY
    resetGroqClient()
    const res = await POST(post({ logs: '[ERROR] boom' }))
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/GROQ_API_KEY/) })
  })

  it('falls back to the next model when the first is retired', async () => {
    createCompletion
      .mockRejectedValueOnce(Object.assign(new Error('model `x` does not exist'), { status: 404 }))
      .mockResolvedValueOnce(completion(VALID))

    const res = await POST(post({ logs: '[ERROR] boom' }))
    expect(res.status).toBe(200)
    expect(createCompletion).toHaveBeenCalledTimes(2)
  })

  it('reports a clear 503 when every model is unavailable', async () => {
    createCompletion.mockRejectedValue(
      Object.assign(new Error('model does not exist'), { status: 404 })
    )
    const res = await POST(post({ logs: '[ERROR] boom' }))
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/GROQ_MODEL/) })
  })

  it('does not retry other models on an auth failure', async () => {
    createCompletion.mockRejectedValue(
      Object.assign(new Error('invalid api key'), { status: 401 })
    )
    const res = await POST(post({ logs: '[ERROR] boom' }))
    expect(res.status).toBe(401)
    expect(createCompletion).toHaveBeenCalledTimes(1)
  })

  it('surfaces a rate limit from the provider', async () => {
    createCompletion.mockRejectedValue(
      Object.assign(new Error('rate limit exceeded'), { status: 429 })
    )
    const res = await POST(post({ logs: '[ERROR] boom' }))
    expect(res.status).toBe(429)
  })

  it('enforces its own rate limit per client', async () => {
    createCompletion.mockResolvedValue(completion(VALID))
    for (let i = 0; i < 10; i++) {
      expect((await POST(post({ logs: 'x' }, '9.9.9.9'))).status).toBe(200)
    }
    const blocked = await POST(post({ logs: 'x' }, '9.9.9.9'))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()

    // A different client is unaffected.
    expect((await POST(post({ logs: 'x' }, '8.8.8.8'))).status).toBe(200)
  })

  it('returns 400 for a non-JSON body', async () => {
    const req = new Request('http://localhost/api/triage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    }) as never
    expect((await POST(req)).status).toBe(400)
  })
})
