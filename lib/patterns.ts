import type { Incident, Severity } from './types'

/** Rolling window used to decide whether a repeat is current rather than historical. */
export const PATTERN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** Occurrences inside the window before a repeat is called systemic. */
export const SYSTEMIC_THRESHOLD = 3

/**
 * Token overlap required to treat two titles as the same failure.
 *
 * Tuned against real triage output: AI-written titles for one failure mode
 * share their distinctive nouns but vary in phrasing, so exact matching groups
 * almost nothing while a very low threshold merges unrelated failures.
 */
export const SIMILARITY_THRESHOLD = 0.3

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'on', 'in', 'at', 'to', 'for', 'of', 'from', 'by', 'with', 'and', 'or',
  'due', 'after', 'during', 'has', 'have', 'had', 'its', 'it', 'this', 'that',
  'error', 'issue', 'problem', 'incident', 'detected', 'failure', 'failed',
])

/**
 * Crude suffix stripping so "OOMKilled" and "OOMKill", or "restarting" and
 * "restart", collapse together. A real stemmer would be overkill: these titles
 * are short, technical, and mostly nouns.
 */
function stem(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3)
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2)
  if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

/** Reduces a title to its distinctive tokens. Digits and punctuation carry no signal. */
export function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[0-9]+/g, ' ')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
      .map(stem)
  )
}

/** Jaccard index: shared tokens over total distinct tokens. */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / (a.size + b.size - shared)
}

export type PatternKind = 'repeat' | 'component'

export interface Pattern {
  key: string
  kind: PatternKind
  component: string
  /** Human-readable label: the most recent title in the group. */
  label: string
  /** Highest severity seen across the group. */
  severity: Severity
  count: number
  /** Occurrences inside the rolling window. */
  recentCount: number
  firstSeen: string
  lastSeen: string
  unresolved: number
  systemic: boolean
  incidentIds: string[]
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 }

function byComponent(incidents: Incident[]): Map<string, Incident[]> {
  const groups = new Map<string, Incident[]>()
  for (const incident of incidents) {
    const component = incident.component?.trim() || 'unknown'
    const bucket = groups.get(component)
    if (bucket) bucket.push(incident)
    else groups.set(component, [incident])
  }
  return groups
}

/**
 * Greedy single-pass clustering of one component's incidents by title
 * similarity. Greedy rather than exhaustive because groups are small and the
 * result has to be stable and explainable, not optimal.
 */
function cluster(incidents: Incident[]): Incident[][] {
  const clusters: { tokens: Set<string>; members: Incident[] }[] = []

  for (const incident of incidents) {
    const tokens = tokenize(incident.title ?? '')
    if (tokens.size === 0) continue

    const match = clusters.find((c) => similarity(c.tokens, tokens) >= SIMILARITY_THRESHOLD)
    if (match) {
      match.members.push(incident)
      // Union keeps the cluster reachable as phrasing drifts over time.
      for (const token of tokens) match.tokens.add(token)
    } else {
      clusters.push({ tokens, members: [incident] })
    }
  }

  return clusters.map((c) => c.members)
}

function summarize(
  key: string,
  kind: PatternKind,
  members: Incident[],
  now: number
): Pattern {
  const sorted = [...members].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  )

  const recentCount = sorted.filter((incident) => {
    const at = Date.parse(incident.created_at)
    return Number.isFinite(at) && now - at <= PATTERN_WINDOW_MS
  }).length

  const severity = sorted.reduce<Severity>(
    (worst, incident) =>
      SEVERITY_RANK[incident.severity] > SEVERITY_RANK[worst] ? incident.severity : worst,
    'info'
  )

  return {
    key,
    kind,
    component: sorted[0].component?.trim() || 'unknown',
    label: sorted[sorted.length - 1].title,
    severity,
    count: sorted.length,
    recentCount,
    firstSeen: sorted[0].created_at,
    lastSeen: sorted[sorted.length - 1].created_at,
    unresolved: sorted.filter((incident) => incident.status !== 'resolved').length,
    systemic: recentCount >= SYSTEMIC_THRESHOLD,
    incidentIds: sorted.map((incident) => incident.id),
  }
}

/**
 * Finds recurring incidents.
 *
 * Two distinct signals are reported:
 * - `repeat`: the same failure mode hitting one component more than once.
 * - `component`: one component producing many incidents in the window, even
 *   when each failure differs — a component that breaks in three different
 *   ways is as much a problem as one that breaks the same way three times.
 *
 * A component-level pattern is suppressed when a single repeat cluster already
 * accounts for all of that component's incidents, so the panel never says the
 * same thing twice.
 */
export function detectPatterns(incidents: Incident[], now: number = Date.now()): Pattern[] {
  const patterns: Pattern[] = []

  for (const [component, members] of byComponent(incidents)) {
    const clusters = cluster(members)

    for (const [index, group] of clusters.entries()) {
      if (group.length < 2) continue
      patterns.push(summarize(`repeat::${component}::${index}`, 'repeat', group, now))
    }

    const explained = clusters.some(
      (group) => group.length >= 2 && group.length === members.length
    )
    if (!explained && members.length >= SYSTEMIC_THRESHOLD) {
      const pattern = summarize(`component::${component}`, 'component', members, now)
      // Only worth reporting when the volume is recent.
      if (pattern.recentCount >= SYSTEMIC_THRESHOLD) patterns.push(pattern)
    }
  }

  return patterns.sort(
    (a, b) =>
      Number(b.systemic) - Number(a.systemic) ||
      b.recentCount - a.recentCount ||
      b.count - a.count ||
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  )
}

/** One-line summary, phrased the way an on-call engineer would say it. */
export function describePattern(pattern: Pattern): string {
  const scope =
    pattern.kind === 'component'
      ? `${pattern.count} incidents on ${pattern.component}`
      : `${pattern.count}× on ${pattern.component}`

  return pattern.systemic ? `${scope} — ${pattern.recentCount} in the last 7 days` : scope
}
