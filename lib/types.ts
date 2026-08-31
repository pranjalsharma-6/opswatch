export type Severity = 'critical' | 'warning' | 'info'
export type Status = 'open' | 'in-progress' | 'resolved'

export interface Incident {
  id: string
  incident_no: string
  severity: Severity
  title: string
  root_cause: string
  impact: string
  fix: string
  component: string
  status: Status
  log_snippet: string
  created_at: string
  resolved_at: string | null
}

export interface TriageResult {
  severity: Severity
  title: string
  root_cause: string
  impact: string
  fix: string
  component: string
}

/** Payload accepted by POST /api/incidents. incident_no is assigned by the database. */
export interface NewIncident extends TriageResult {
  log_snippet: string
}

export const STATUSES: readonly Status[] = ['open', 'in-progress', 'resolved'] as const
