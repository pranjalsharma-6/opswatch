import { describe, expect, it } from 'vitest'
import {
  MAX_LOG_CHARS,
  normalizeTriage,
  parseTriageResponse,
  validateLogs,
} from '../lib/triage'

describe('parseTriageResponse', () => {
  it('parses a multi-step fix containing escaped newlines', () => {
    // Regression: the previous implementation escaped every newline across the
    // whole payload and unescaped it after matching, which turned the model's
    // "\n" escapes into literal newlines inside a JSON string. That is invalid
    // JSON, so every response with a numbered fix threw.
    const raw = `{
  "severity": "critical",
  "title": "Container OOMKilled",
  "root_cause": "api-server exceeded its 512Mi memory limit",
  "impact": "API unavailable for all users",
  "fix": "1. Raise the memory limit\\n2. Check for leaks\\n3. Redeploy",
  "component": "api-server"
}`
    const result = parseTriageResponse(raw)
    expect(result.severity).toBe('critical')
    expect(result.fix).toBe('1. Raise the memory limit\n2. Check for leaks\n3. Redeploy')
    expect(result.fix.split('\n')).toHaveLength(3)
  })

  it('strips a markdown code fence', () => {
    const raw = '```json\n{"severity":"info","title":"Scaled out","root_cause":"traffic","impact":"none","fix":"1. none","component":"hpa"}\n```'
    expect(parseTriageResponse(raw).title).toBe('Scaled out')
  })

  it('recovers JSON surrounded by prose', () => {
    const raw = 'Here is the analysis:\n{"severity":"warning","title":"Disk pressure","root_cause":"log growth","impact":"writes failing","fix":"1. Rotate logs","component":"node-03"}\nHope that helps.'
    expect(parseTriageResponse(raw).severity).toBe('warning')
  })

  it('throws on an empty response', () => {
    expect(() => parseTriageResponse('   ')).toThrow(/empty/i)
  })

  it('throws on unparseable output', () => {
    expect(() => parseTriageResponse('the server is on fire')).toThrow(/not valid JSON/i)
  })
})

describe('normalizeTriage', () => {
  it('defaults an unknown severity to info rather than trusting the model', () => {
    expect(normalizeTriage({ severity: 'catastrophic', title: 'x' }).severity).toBe('info')
  })

  it('accepts severity in any casing', () => {
    expect(normalizeTriage({ severity: '  CRITICAL ' }).severity).toBe('critical')
  })

  it('fills in every missing field', () => {
    const result = normalizeTriage({})
    expect(result.title).toBe('Incident detected')
    expect(result.component).toBe('unknown')
    expect(result.fix).toContain('1.')
  })

  it('tolerates null and non-object input', () => {
    expect(normalizeTriage(null).severity).toBe('info')
    expect(normalizeTriage('nonsense').severity).toBe('info')
  })
})

describe('validateLogs', () => {
  it('rejects empty input', () => {
    expect(validateLogs('   ')).toMatch(/paste some log/i)
    expect(validateLogs(undefined)).toBeTruthy()
  })

  it('rejects input past the size cap', () => {
    expect(validateLogs('x'.repeat(MAX_LOG_CHARS + 1))).toMatch(/too long/i)
  })

  it('accepts valid logs', () => {
    expect(validateLogs('[ERROR] OOMKilled')).toBeNull()
  })
})
