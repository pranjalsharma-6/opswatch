import { describe, expect, it } from 'vitest'
import { detectPatterns, describePattern, similarity, tokenize } from '../lib/patterns'
import type { Incident } from '../lib/types'

const NOW = Date.parse('2024-03-01T12:00:00.000Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

let seq = 0
function incident(overrides: Partial<Incident> = {}): Incident {
  seq += 1
  return {
    id: `id-${seq}`,
    incident_no: `INC-${String(seq).padStart(3, '0')}`,
    severity: 'critical',
    title: 'OOMKill: api-server CrashLoopBackOff',
    root_cause: 'memory',
    impact: 'down',
    fix: '1. fix',
    component: 'api-server',
    status: 'open',
    log_snippet: '',
    created_at: daysAgo(1),
    resolved_at: null,
    ...overrides,
  }
}

describe('tokenize', () => {
  it('ignores digits, punctuation, and case', () => {
    expect([...tokenize('Disk full on node-02')].sort()).toEqual(['disk', 'full', 'node'])
  })

  it('drops stopwords and short tokens', () => {
    expect([...tokenize('The disk is full')].sort()).toEqual(['disk', 'full'])
  })

  it('stems so tense and plurals collapse', () => {
    expect(tokenize('OOMKilled')).toEqual(tokenize('OOMKill'))
    expect(tokenize('container restarting')).toEqual(tokenize('container restart'))
    expect(tokenize('replicas')).toEqual(tokenize('replica'))
  })

  it('returns empty for a title with no signal', () => {
    expect(tokenize('the a is').size).toBe(0)
    expect(tokenize('').size).toBe(0)
  })
})

describe('similarity', () => {
  it('is 1 for identical token sets and 0 for disjoint ones', () => {
    expect(similarity(tokenize('disk full'), tokenize('full disk'))).toBe(1)
    expect(similarity(tokenize('disk full'), tokenize('redis cluster'))).toBe(0)
  })

  it('is 0 when either side is empty', () => {
    expect(similarity(new Set(), tokenize('disk'))).toBe(0)
  })

  it('scores partial overlap between 0 and 1', () => {
    const score = similarity(
      tokenize('OOMKill: api-server CrashLoopBackOff'),
      tokenize('OOMKilled on api-server, container restarting')
    )
    expect(score).toBeGreaterThan(0.3)
    expect(score).toBeLessThan(1)
  })
})

describe('detectPatterns', () => {
  it('returns nothing for a single incident', () => {
    expect(detectPatterns([incident()], NOW)).toEqual([])
  })

  it('groups repeats of the same failure on the same component', () => {
    const patterns = detectPatterns(
      [incident({ created_at: daysAgo(1) }), incident({ created_at: daysAgo(2) })],
      NOW
    )
    expect(patterns).toHaveLength(1)
    expect(patterns[0].count).toBe(2)
    expect(patterns[0].component).toBe('api-server')
  })

  it('does not group the same failure on different components', () => {
    const patterns = detectPatterns(
      [incident({ component: 'api-server' }), incident({ component: 'worker' })],
      NOW
    )
    expect(patterns).toEqual([])
  })

  it('flags three occurrences in the window as systemic', () => {
    const patterns = detectPatterns(
      [
        incident({ created_at: daysAgo(1) }),
        incident({ created_at: daysAgo(2) }),
        incident({ created_at: daysAgo(3) }),
      ],
      NOW
    )
    expect(patterns[0].systemic).toBe(true)
    expect(patterns[0].recentCount).toBe(3)
  })

  it('does not flag old repeats as systemic', () => {
    const patterns = detectPatterns(
      [
        incident({ created_at: daysAgo(40) }),
        incident({ created_at: daysAgo(50) }),
        incident({ created_at: daysAgo(60) }),
      ],
      NOW
    )
    expect(patterns[0].count).toBe(3)
    expect(patterns[0].recentCount).toBe(0)
    expect(patterns[0].systemic).toBe(false)
  })

  it('reports the worst severity in the group', () => {
    const patterns = detectPatterns(
      [incident({ severity: 'info' }), incident({ severity: 'critical' })],
      NOW
    )
    expect(patterns[0].severity).toBe('critical')
  })

  it('counts unresolved members', () => {
    const patterns = detectPatterns(
      [
        incident({ status: 'resolved' }),
        incident({ status: 'open' }),
        incident({ status: 'in-progress' }),
      ],
      NOW
    )
    expect(patterns[0].unresolved).toBe(2)
  })

  it('tracks first and last seen in chronological order', () => {
    const patterns = detectPatterns(
      [incident({ created_at: daysAgo(1) }), incident({ created_at: daysAgo(5) })],
      NOW
    )
    expect(Date.parse(patterns[0].firstSeen)).toBeLessThan(Date.parse(patterns[0].lastSeen))
  })

  it('sorts systemic patterns first', () => {
    const patterns = detectPatterns(
      [
        // Two old repeats: a pattern, but not systemic.
        incident({ component: 'db', title: 'Disk full', created_at: daysAgo(60) }),
        incident({ component: 'db', title: 'Disk full', created_at: daysAgo(61) }),
        // Three recent repeats: systemic.
        incident({ component: 'redis', title: 'Redis cluster down', created_at: daysAgo(1) }),
        incident({ component: 'redis', title: 'Redis cluster down', created_at: daysAgo(2) }),
        incident({ component: 'redis', title: 'Redis cluster down', created_at: daysAgo(3) }),
      ],
      NOW
    )
    expect(patterns[0].component).toBe('redis')
    expect(patterns[0].systemic).toBe(true)
    expect(patterns[1].systemic).toBe(false)
  })

  it('ignores incidents whose title carries no signal', () => {
    expect(detectPatterns([incident({ title: 'the a' }), incident({ title: 'is an' })], NOW)).toEqual([])
  })

  it('groups differently worded reports of the same failure', () => {
    const patterns = detectPatterns(
      [
        incident({ title: 'OOMKill: api-server CrashLoopBackOff', created_at: daysAgo(1) }),
        incident({ title: 'OOMKilled on api-server, container restarting', created_at: daysAgo(2) }),
        incident({ title: 'OOMKill: api-server exceeded memory limit', created_at: daysAgo(3) }),
      ],
      NOW
    )
    expect(patterns).toHaveLength(1)
    expect(patterns[0].kind).toBe('repeat')
    expect(patterns[0].count).toBe(3)
    expect(patterns[0].systemic).toBe(true)
  })

  it('does not merge unrelated failures on the same component', () => {
    const patterns = detectPatterns(
      [
        incident({ title: 'Redis cluster down', created_at: daysAgo(1) }),
        incident({ title: 'TLS certificate expired', created_at: daysAgo(2) }),
      ],
      NOW
    )
    expect(patterns.filter((p) => p.kind === 'repeat')).toEqual([])
  })

  it('reports a component that breaks in several different ways', () => {
    const patterns = detectPatterns(
      [
        incident({ component: 'web', title: 'Redis cluster down', created_at: daysAgo(1) }),
        incident({ component: 'web', title: 'TLS certificate expired', created_at: daysAgo(2) }),
        incident({ component: 'web', title: 'Disk full on volume', created_at: daysAgo(3) }),
      ],
      NOW
    )
    const componentPattern = patterns.find((p) => p.kind === 'component')
    expect(componentPattern).toBeDefined()
    expect(componentPattern!.count).toBe(3)
  })

  it('does not report a component pattern that one repeat already explains', () => {
    const patterns = detectPatterns(
      [
        incident({ title: 'Disk full on node', created_at: daysAgo(1) }),
        incident({ title: 'Disk full blocking writes', created_at: daysAgo(2) }),
        incident({ title: 'Disk full on volume', created_at: daysAgo(3) }),
      ],
      NOW
    )
    expect(patterns.filter((p) => p.kind === 'component')).toEqual([])
    expect(patterns).toHaveLength(1)
  })

  it('handles an empty list', () => {
    expect(detectPatterns([], NOW)).toEqual([])
  })
})

describe('describePattern', () => {
  it('mentions the window only when systemic', () => {
    const [systemic] = detectPatterns(
      [incident({ created_at: daysAgo(1) }), incident({ created_at: daysAgo(2) }), incident({ created_at: daysAgo(3) })],
      NOW
    )
    expect(describePattern(systemic)).toContain('last 7 days')

    const [old] = detectPatterns(
      [incident({ created_at: daysAgo(60) }), incident({ created_at: daysAgo(61) })],
      NOW
    )
    expect(describePattern(old)).not.toContain('last 7 days')
  })
})
