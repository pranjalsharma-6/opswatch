import { NextResponse, type NextRequest } from 'next/server'
import type Groq from 'groq-sdk'
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

type Params = Parameters<Groq['chat']['completions']['create']>[0]

function requestParams(model: string, logs: string, stream: boolean): Params {
  return {
    model,
    stream,
    max_tokens: 1024,
    temperature: 0.1,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'triage', strict: true, schema: TRIAGE_SCHEMA },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyse these logs:\n\n${logs}` },
    ],
  } as Params
}

export async function POST(req: NextRequest) {
  pruneRateLimits()
  const limit = rateLimit(`triage:${clientKey(req.headers)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  let body: { logs?: unknown; stream?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const invalid = validateLogs(body.logs)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  const logs = body.logs as string
  const wantsStream = body.stream === true

  let client: Groq
  try {
    client = getGroqClient()
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  // Resolve a working model BEFORE returning a response. Falling back after
  // the stream has opened would mean a 200 whose body reports failure, so
  // auth, rate-limit and retired-model errors are surfaced as HTTP statuses.
  const models = getModelChain()
  let lastError: unknown = null

  for (const model of models) {
    try {
      const completion = await client.chat.completions.create(
        requestParams(model, logs, wantsStream)
      )

      if (!wantsStream) {
        const raw =
          (completion as Groq.Chat.ChatCompletion).choices[0]?.message?.content ?? ''
        return NextResponse.json(parseTriageResponse(raw))
      }

      return streamResponse(completion as AsyncIterable<Groq.Chat.ChatCompletionChunk>)
    } catch (error) {
      lastError = error
      if (isModelUnavailableError(error)) {
        console.warn(`[opswatch] model "${model}" unavailable, trying the next one`)
        continue
      }
      break
    }
  }

  return NextResponse.json(
    { error: describeError(lastError, models) },
    { status: statusFor(lastError) }
  )
}

/**
 * Relays model output as Server-Sent Events.
 *
 * Deltas carry raw text fragments; the client accumulates and parses them
 * incrementally. The terminating `done` event carries the validated result, so
 * the client never has to trust its own partial parse as final.
 */
function streamResponse(completion: AsyncIterable<Groq.Chat.ChatCompletionChunk>): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

      let raw = ''
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content
          if (!delta) continue
          raw += delta
          send({ type: 'delta', content: delta })
        }

        send({ type: 'done', result: parseTriageResponse(raw) })
      } catch (error) {
        // The response is already committed as 200 here, so failures have to
        // travel in-band rather than as a status code.
        const message = error instanceof Error ? error.message : 'Triage failed'
        send({ type: 'error', error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx-style proxies not to buffer, which would defeat streaming.
      'X-Accel-Buffering': 'no',
    },
  })
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
