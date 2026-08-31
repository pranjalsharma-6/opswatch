'use client'
import type { Incident } from '@/lib/types'
import { formatDuration, formatRelative } from '@/lib/metrics'

export default function IncidentDrawer({ incident }: { incident: Incident }) {
  const resolvedIn =
    incident.resolved_at && incident.created_at
      ? formatDuration(Date.parse(incident.resolved_at) - Date.parse(incident.created_at))
      : null

  return (
    <div
      className="animate-slide-up grid gap-4 px-5 py-4 sm:grid-cols-2"
      style={{ background: 'rgba(59,130,246,0.03)', borderTop: '1px solid rgba(59,130,246,0.15)' }}
    >
      <Field label="root_cause" value={incident.root_cause} />
      <Field label="impact" value={incident.impact} />

      <div className="sm:col-span-2">
        <p className="field-label mb-1.5">suggested_fix</p>
        <p className="whitespace-pre-line text-[12.5px] leading-relaxed" style={{ color: 'var(--color-ink)' }}>
          {incident.fix}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
        <Meta label="opened" value={formatRelative(incident.created_at)} />
        {resolvedIn && <Meta label="resolved in" value={resolvedIn} />}
        <Meta label="component" value={incident.component} />
      </div>

      {incident.log_snippet && (
        <div className="sm:col-span-2">
          <p className="field-label mb-1.5">log_snippet</p>
          <pre
            className="max-h-40 overflow-auto rounded-lg border px-3.5 py-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words"
            style={{
              background: 'var(--color-field)',
              borderColor: 'var(--color-edge)',
              color: '#6b9fd4',
            }}
          >
            {incident.log_snippet}
          </pre>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="field-label mb-1.5">{label}</p>
      <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--color-ink)' }}>
        {value}
      </p>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="font-mono text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
      {label}: <span style={{ color: 'var(--color-ink-dim)' }}>{value}</span>
    </span>
  )
}
