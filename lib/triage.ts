import type { Severity, TriageResult } from './types'

export const SEVERITIES: readonly Severity[] = ['critical', 'warning', 'info'] as const

/** Upper bound on submitted log text. Guards both cost and model context limits. */
export const MAX_LOG_CHARS = 20_000

/**
 * JSON Schema handed to Groq's Structured Outputs mode.
 *
 * With this the model is constrained to emit conforming JSON, which removes the
 * need to strip markdown fences or repair the payload by hand.
 */
export const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: [...SEVERITIES] },
    title: { type: 'string' },
    root_cause: { type: 'string' },
    impact: { type: 'string' },
    fix: { type: 'string' },
    component: { type: 'string' },
  },
  required: ['severity', 'title', 'root_cause', 'impact', 'fix', 'component'],
  additionalProperties: false,
} as const

export const SYSTEM_PROMPT = `You are a senior SRE analysing production logs. Reply with a single JSON object.

Fields:
- severity: exactly one of "critical", "warning", "info".
  - critical: full outage, data loss, cascading failure, or security breach.
  - warning: degraded performance, partial failure, or approaching a limit.
  - info: normal operations, successful events, or routine scaling.
- title: under 60 characters, no trailing period.
- root_cause: one sentence naming the actual cause, not the symptom.
- impact: one sentence on user- or business-facing effect.
- fix: numbered remediation steps separated by newlines, e.g. "1. Raise the memory limit\\n2. Redeploy".
- component: the failing service or subsystem, e.g. "api-server".

Base every field on evidence in the logs. Do not invent hostnames or metrics.`

/**
 * Normalises a parsed model response into a TriageResult.
 *
 * Structured Outputs makes conforming output the norm, but the model is still
 * free to return an unexpected severity or omit a field, so every value is
 * validated and defaulted here rather than trusted.
 */
export function normalizeTriage(raw: unknown): TriageResult {
  const obj = (raw ?? {}) as Record<string, unknown>

  const str = (value: unknown, fallback: string): string => {
    const s = typeof value === 'string' ? value.trim() : ''
    return s.length > 0 ? s : fallback
  }

  const severity =
    typeof obj.severity === 'string' &&
    SEVERITIES.includes(obj.severity.toLowerCase().trim() as Severity)
      ? (obj.severity.toLowerCase().trim() as Severity)
      : 'info'

  return {
    severity,
    title: str(obj.title, 'Incident detected').slice(0, 120),
    root_cause: str(obj.root_cause, 'Root cause under investigation'),
    impact: str(obj.impact, 'Impact assessment in progress'),
    fix: str(obj.fix, '1. Investigate the logs\n2. Apply a fix\n3. Monitor recovery'),
    component: str(obj.component, 'unknown').slice(0, 80),
  }
}

/**
 * Parses a model response into a TriageResult.
 *
 * Structured Outputs returns bare JSON, but json_object mode (and fallback
 * models) can still wrap output in a ```json fence, so that one case is
 * handled. Note what this deliberately does NOT do: rewrite newlines inside
 * the payload. Escaping "\n" to "\\n" across the whole string and unescaping
 * afterwards turns the model's escaped newlines into literal newlines inside
 * JSON string literals, which is invalid JSON and throws on every multi-step
 * "fix" value.
 */
export function parseTriageResponse(raw: string): TriageResult {
  const text = raw.trim()
  if (!text) throw new Error('The model returned an empty response.')

  const unfenced = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  const candidates = [unfenced]
  const firstBrace = unfenced.indexOf('{')
  const lastBrace = unfenced.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(unfenced.slice(firstBrace, lastBrace + 1))
  }

  for (const candidate of candidates) {
    try {
      return normalizeTriage(JSON.parse(candidate))
    } catch {
      // Try the next candidate before giving up.
    }
  }

  throw new Error('The model returned a response that was not valid JSON.')
}

/** Validates raw user-submitted log text. Returns an error message, or null when valid. */
export function validateLogs(logs: unknown): string | null {
  if (typeof logs !== 'string' || !logs.trim()) {
    return 'Paste some log output first.'
  }
  if (logs.length > MAX_LOG_CHARS) {
    return `Logs are too long (${logs.length.toLocaleString()} characters). The limit is ${MAX_LOG_CHARS.toLocaleString()} — paste the relevant excerpt instead.`
  }
  return null
}
