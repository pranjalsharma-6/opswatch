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
}

export interface TriageResult {
  severity: Severity
  title: string
  root_cause: string
  impact: string
  fix: string
  component: string
}