import { describe, expect, it } from 'vitest'
import { computeMetrics, formatDuration, formatRelative, toCsv } from '../lib/metrics'
import type { Incident } from '../lib/types'

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: crypto.randomUUID(),
    incident_no: 'INC-001',
    severity: 'critical',
    title: 'Test incident',
    root_cause: 'cause',
    impact: 'impact',
    fix: '1. fix',
    component: 'api-server',
    status: 'open',
    log_snippet: '[ERROR] boom',
    created_at: '2024-01-15T02:00:00.000Z',
    resolved_at: null,
    ...overrides,
  }
}

describe('computeMetrics', () => {
  it('returns empty metrics for no incidents', () => {
    const m = computeMetrics([])
    expect(m.total).toBe(0)
    expect(m.mttrMs).toBeNull()
    expect(m.resolutionRate).toBe(0)
    expect(m.topComponent).toBeNull()
  })

  it('counts by severity and status', () => {
    const m = computeMetrics([
      incident({ severity: 'critical', status: 'open' }),
      incident({ severity: 'warning', status: 'resolved', resolved_at: '2024-01-15T03:00:00.000Z' }),
      incident({ severity: 'info', status: 'in-progress' }),
    ])
    expect(m.bySeverity).toEqual({ critical: 1, warning: 1, info: 1 })
    expect(m.byStatus).toEqual({ open: 1, 'in-progress': 1, resolved: 1 })
    expect(m.resolutionRate).toBeCloseTo(1 / 3)
  })

  it('averages MTTR over resolved incidents only', () => {
    const m = computeMetrics([
      incident({ status: 'resolved', created_at: '2024-01-15T02:00:00.000Z', resolved_at: '2024-01-15T03:00:00.000Z' }),
      incident({ status: 'resolved', created_at: '2024-01-15T02:00:00.000Z', resolved_at: '2024-01-15T05:00:00.000Z' }),
      incident({ status: 'open' }),
    ])
    expect(m.mttrMs).toBe(2 * 60 * 60 * 1000)
  })

  it('ignores resolved rows with no resolved_at instead of counting them as zero', () => {
    const m = computeMetrics([
      incident({ status: 'resolved', resolved_at: null }),
      incident({ status: 'resolved', created_at: '2024-01-15T02:00:00.000Z', resolved_at: '2024-01-15T03:00:00.000Z' }),
    ])
    expect(m.mttrMs).toBe(60 * 60 * 1000)
  })

  it('identifies the most affected component', () => {
    const m = computeMetrics([
      incident({ component: 'redis' }),
      incident({ component: 'redis' }),
      incident({ component: 'api-server' }),
    ])
    expect(m.topComponent).toEqual({ name: 'redis', count: 2 })
  })
})

describe('formatDuration', () => {
  it('formats across each unit boundary', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(5 * 60_000)).toBe('5m')
    expect(formatDuration(2 * 3_600_000)).toBe('2h')
    expect(formatDuration(2 * 3_600_000 + 14 * 60_000)).toBe('2h 14m')
    expect(formatDuration(26 * 3_600_000)).toBe('1d 2h')
  })

  it('returns a dash for null or invalid input', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(NaN)).toBe('—')
  })
})

describe('formatRelative', () => {
  it('describes recent and older timestamps', () => {
    const now = Date.parse('2024-01-15T03:00:00.000Z')
    expect(formatRelative('2024-01-15T02:59:30.000Z', now)).toBe('just now')
    expect(formatRelative('2024-01-15T02:00:00.000Z', now)).toBe('1h ago')
    expect(formatRelative('not-a-date', now)).toBe('—')
  })
})

describe('toCsv', () => {
  it('emits a header plus one row per incident', () => {
    const csv = toCsv([incident({ incident_no: 'INC-007' })])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('incident_no')
    expect(lines[1]).toContain('INC-007')
  })

  it('escapes quotes, commas and newlines so the CSV stays well formed', () => {
    const csv = toCsv([incident({ title: 'He said "boom", loudly', fix: '1. a\n2. b' })])
    expect(csv).toContain('"He said ""boom"", loudly"')
    expect(csv).toContain('"1. a\n2. b"')
  })
})
