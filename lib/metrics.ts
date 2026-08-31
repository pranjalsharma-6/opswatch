import type { Incident, Severity, Status } from './types'

export interface Metrics {
  total: number
  bySeverity: Record<Severity, number>
  byStatus: Record<Status, number>
  /** Mean time to resolution in ms across resolved incidents, or null when none. */
  mttrMs: number | null
  /** Share of incidents resolved, 0-1. */
  resolutionRate: number
  /** Component with the most incidents, or null. */
  topComponent: { name: string; count: number } | null
}

export function computeMetrics(incidents: Incident[]): Metrics {
  const bySeverity: Record<Severity, number> = { critical: 0, warning: 0, info: 0 }
  const byStatus: Record<Status, number> = { open: 0, 'in-progress': 0, resolved: 0 }
  const componentCounts = new Map<string, number>()

  let resolutionTotal = 0
  let resolutionCount = 0

  for (const incident of incidents) {
    if (incident.severity in bySeverity) bySeverity[incident.severity] += 1
    if (incident.status in byStatus) byStatus[incident.status] += 1

    const component = incident.component?.trim()
    if (component) {
      componentCounts.set(component, (componentCounts.get(component) ?? 0) + 1)
    }

    // Only resolved incidents with both timestamps contribute to MTTR; rows
    // predating the resolved_at column are skipped rather than counted as zero.
    if (incident.status === 'resolved' && incident.resolved_at && incident.created_at) {
      const elapsed = Date.parse(incident.resolved_at) - Date.parse(incident.created_at)
      if (Number.isFinite(elapsed) && elapsed >= 0) {
        resolutionTotal += elapsed
        resolutionCount += 1
      }
    }
  }

  let topComponent: Metrics['topComponent'] = null
  for (const [name, count] of componentCounts) {
    if (!topComponent || count > topComponent.count) topComponent = { name, count }
  }

  return {
    total: incidents.length,
    bySeverity,
    byStatus,
    mttrMs: resolutionCount > 0 ? resolutionTotal / resolutionCount : null,
    resolutionRate: incidents.length > 0 ? byStatus.resolved / incidents.length : 0,
    topComponent,
  }
}

/** Formats a duration as a compact operator-friendly string, e.g. "2h 14m". */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—'

  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`
}

/** Relative timestamp for table rows, e.g. "4m ago". */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return '—'
  const elapsed = now - then
  if (elapsed < 60_000) return 'just now'
  return `${formatDuration(elapsed)} ago`
}

/** Serialises incidents to CSV for export. */
export function toCsv(incidents: Incident[]): string {
  const columns: (keyof Incident)[] = [
    'incident_no', 'severity', 'status', 'title', 'component',
    'root_cause', 'impact', 'fix', 'created_at', 'resolved_at',
  ]

  const escape = (value: unknown): string => {
    const s = value == null ? '' : String(value)
    // Always quote: fields contain commas, newlines, and quotes.
    return `"${s.replace(/"/g, '""')}"`
  }

  return [
    columns.join(','),
    ...incidents.map((incident) => columns.map((c) => escape(incident[c])).join(',')),
  ].join('\n')
}
