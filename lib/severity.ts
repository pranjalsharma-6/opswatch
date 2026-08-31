import type { Severity, Status } from './types'

export interface Tone {
  text: string
  bg: string
  border: string
}

/** Single source of truth for severity colours, so chips/cards/charts agree. */
export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)' },
  warning: { text: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  info: { text: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.28)' },
}

export const STATUS_TONE: Record<Status, Tone> = {
  open: { text: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)' },
  'in-progress': { text: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  resolved: { text: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)' },
}

export const NEXT_STATUS: Record<Status, Status> = {
  open: 'in-progress',
  'in-progress': 'resolved',
  resolved: 'open',
}

export function toneStyle(tone: Tone): React.CSSProperties {
  return { color: tone.text, background: tone.bg, borderColor: tone.border }
}

export function severityTone(severity: string): Tone {
  return SEVERITY_TONE[severity as Severity] ?? SEVERITY_TONE.info
}

export function statusTone(status: string): Tone {
  return STATUS_TONE[status as Status] ?? STATUS_TONE.open
}
