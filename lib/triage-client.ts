import type { TriageResult } from './types'
import { partialFields } from './partial-json'

/** Fields streamed back, in the order they are rendered. */
export const TRIAGE_FIELDS = [
  'severity',
  'title',
  'root_cause',
  'impact',
  'fix',
  'component',
] as const

export interface StreamHandlers {
  /** Called whenever a field gains new text. */
  onPartial: (fields: Record<string, string>) => void
  onDone: (result: TriageResult) => void
  onError: (message: string) => void
}

/**
 * Reads one SSE frame per `data:` line out of a raw chunk buffer.
 *
 * Returns the parsed payloads plus whatever trailing bytes belong to an
 * incomplete frame, since a chunk boundary can land mid-message.
 */
export function parseSseBuffer(buffer: string): { events: unknown[]; rest: string } {
  const events: unknown[] = []
  const frames = buffer.split('\n\n')
  // The final piece is only complete if the buffer ended on a delimiter.
  const rest = frames.pop() ?? ''

  for (const frame of frames) {
    for (const line of frame.split('\n')) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        events.push(JSON.parse(payload))
      } catch {
        // Ignore a malformed frame rather than aborting the stream.
      }
    }
  }

  return { events, rest }
}

/**
 * Streams a triage request, reporting fields as they arrive.
 *
 * The `done` event carries the server-validated result, so the incrementally
 * parsed fields are only ever used for display.
 */
export async function streamTriage(
  logs: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs, stream: true }),
    signal,
  })

  // Errors resolved before the stream opened arrive as ordinary JSON.
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}) as { error?: string })
    handlers.onError(payload.error || `Triage failed (HTTP ${res.status})`)
    return
  }

  if (!res.body) {
    handlers.onError('Streaming is not supported by this browser.')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let raw = ''
  let settled = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const { events, rest } = parseSseBuffer(buffer)
    buffer = rest

    for (const event of events) {
      const message = event as { type?: string; content?: string; result?: TriageResult; error?: string }

      if (message.type === 'delta' && typeof message.content === 'string') {
        raw += message.content
        handlers.onPartial(partialFields(raw, TRIAGE_FIELDS))
      } else if (message.type === 'done' && message.result) {
        settled = true
        handlers.onDone(message.result)
      } else if (message.type === 'error') {
        settled = true
        handlers.onError(message.error || 'Triage failed')
      }
    }
  }

  // A stream that closes without a terminating event means the connection
  // dropped mid-response.
  if (!settled) handlers.onError('The triage stream ended unexpectedly. Try again.')
}
