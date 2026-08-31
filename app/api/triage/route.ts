import { NextResponse, type NextRequest } from 'next/server'
import { getGroqClient, getModelChain, isModelUnavailableError } from '@/lib/groq'
import { ConfigError } from '@/lib/errors'
import { clientKey, pruneRateLimits, rateLimit } from '@/lib/rate-limit'
import {
  SYSTEM_PROMPT,
  TRIAGE_SCHEMA,
  parseTriageResponse,
  validateLogs,
} from '@/lib/triage'

/** Triage calls a third-party model; never serve a cached response. */
export const dynamic = 'force-dynamic'

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

export async function POST(req: NextRequest) {
  pruneRateLimits()
  const limit = rateLimit(`triage:${clientKey(req.headers)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  let logs: unknown
  try {
    ;({ logs } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const invalid = validateLogs(logs)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  let client
  try {
    client = getGroqClient()
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  // Walk the model chain so a retired model id degrades instead of failing.
  const models = getModelChain()
  let lastError: unknown = null

  for (const model of models) {
    try {
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 1024,
        temperature: 0.1,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'triage', strict: true, schema: TRIAGE_SCHEMA },
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyse these logs:\n\n${logs as string}` },
        ],
      })

      const raw = completion.choices[0]?.message?.content ?? ''
      return NextResponse.json(parseTriageResponse(raw))
    } catch (error) {
      lastError = error
      if (isModelUnavailableError(error)) {
        console.warn(`[opswatch] model "${model}" unavailable, trying the next one`)
        continue
      }
      break
    }
  }

  return NextResponse.json({ error: describeError(lastError, models) }, { status: statusFor(lastError) })
}

function statusFor(error: unknown): number {
  const status = (error as { status?: number } | null)?.status
  if (status === 401 || status === 403) return 401
  if (status === 429) return 429
  if (isModelUnavailableError(error)) return 503
  return 502
}

/** Maps a provider error to a message that says what to actually do about it. */
function describeError(error: unknown, models: string[]): string {
  const status = (error as { status?: number } | null)?.status

  if (status === 401 || status === 403) {
    return 'Groq rejected the API key. Check GROQ_API_KEY in your environment.'
  }
  if (status === 429) {
    return 'Groq rate limit reached. Wait a moment and try again.'
  }
  if (isModelUnavailableError(error)) {
    return `None of the configured models are available (tried: ${models.join(', ')}). Set GROQ_MODEL to a current model from console.groq.com/docs/models.`
  }
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error')
  return `Triage failed: ${message}`
}
