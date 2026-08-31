/**
 * Tolerant parser for JSON that is still arriving.
 *
 * A streamed model response is only valid JSON once the final brace lands, so
 * `JSON.parse` fails on every intermediate chunk. This closes the value that is
 * mid-flight — an open string, unclosed containers, a key with no value yet —
 * and parses the repaired text, so completed fields can render while the rest
 * is still streaming.
 */

/** How many trailing characters may be discarded to find a parseable prefix. */
const MAX_BACKTRACK = 400

interface ScanState {
  /** Closing characters for still-open containers, outermost first. */
  open: string[]
  inString: boolean
  /** True when the text ends on a backslash that has nothing to escape yet. */
  danglingEscape: boolean
}

function scan(text: string): ScanState {
  const open: string[] = []
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      if (inString) escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') open.push('}')
    else if (char === '[') open.push(']')
    else if (char === '}' || char === ']') open.pop()
  }

  return { open, inString, danglingEscape: escape }
}

/** Repairs `text` into syntactically complete JSON, without trimming anything. */
function close(text: string): string {
  const state = scan(text)
  // A trailing backslash would escape the quote we are about to append.
  let out = state.danglingEscape ? text.slice(0, -1) : text
  if (state.inString) out += '"'
  for (let i = state.open.length - 1; i >= 0; i--) out += state.open[i]
  return out
}

/**
 * Parses a possibly-incomplete JSON string.
 *
 * Returns `undefined` when nothing parseable has arrived yet, so callers can
 * distinguish "not ready" from a legitimately parsed `null`.
 */
export function parsePartialJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return undefined

  // Complete payloads are the common case once the stream finishes.
  try {
    return JSON.parse(trimmed)
  } catch {
    // Fall through to repair.
  }

  // Walk backwards discarding the incomplete tail — a half-written key, a
  // trailing comma, a number that stops mid-exponent — until a prefix parses.
  const floor = Math.max(0, trimmed.length - MAX_BACKTRACK)
  for (let end = trimmed.length; end > floor; end--) {
    const candidate = trimmed.slice(0, end)
    // Cutting inside an escape sequence produces text that can never parse.
    if (candidate.endsWith('\\')) continue

    try {
      return JSON.parse(close(candidate))
    } catch {
      continue
    }
  }

  return undefined
}

/**
 * Extracts the string fields that have fully arrived.
 *
 * Only string values are returned: a partially streamed string is still a
 * usable prefix to display, whereas a partially streamed number or boolean
 * would render a wrong value.
 */
export function partialFields(text: string, keys: readonly string[]): Record<string, string> {
  const parsed = parsePartialJson(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

  const source = parsed as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.length > 0) out[key] = value
  }
  return out
}
