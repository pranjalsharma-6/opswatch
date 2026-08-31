'use client'
import { AlertCircle, AlertTriangle, CheckCircle, Info, Timer } from 'lucide-react'
import type { Incident } from '@/lib/types'
import { computeMetrics, formatDuration } from '@/lib/metrics'

interface Props { incidents: Incident[] }

export default function StatCards({ incidents }: Props) {
  const metrics = computeMetrics(incidents)

  const cards = [
    { label: 'Critical', value: metrics.bySeverity.critical, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Warning', value: metrics.bySeverity.warning, icon: AlertCircle, color: '#f59e0b' },
    { label: 'Info', value: metrics.bySeverity.info, icon: Info, color: '#3b82f6' },
    { label: 'Resolved', value: metrics.byStatus.resolved, icon: CheckCircle, color: '#10b981' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => {
          const active = value > 0
          return (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl border px-4 py-4 transition-colors duration-300 sm:px-5"
              style={{
                background: active ? `${color}1a` : 'var(--color-panel)',
                borderColor: active ? `${color}47` : 'var(--color-edge)',
                borderTopColor: active ? color : 'var(--color-edge)',
                borderTopWidth: 2,
              }}
            >
              <div className="min-w-0">
                <p className="field-label mb-2" style={{ color: 'var(--color-ink-dim)' }}>
                  {label}
                </p>
                <p
                  className="font-mono text-3xl font-semibold leading-none transition-colors"
                  style={{ color: active ? color : 'var(--color-ink-faint)' }}
                >
                  {value}
                </p>
              </div>
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border"
                style={{
                  background: active ? `${color}1a` : 'transparent',
                  borderColor: active ? `${color}47` : 'var(--color-edge)',
                }}
              >
                <Icon size={18} color={active ? color : 'var(--color-ink-faint)'} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Operational metrics: the numbers an on-call lead actually reports on. */}
      <div className="panel grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4"
           style={{ background: 'var(--color-edge)' }}>
        <Metric
          label="MTTR"
          value={formatDuration(metrics.mttrMs)}
          hint="mean time to resolution"
          icon={<Timer size={12} />}
        />
        <Metric
          label="Resolution rate"
          value={metrics.total ? `${Math.round(metrics.resolutionRate * 100)}%` : '—'}
          hint={`${metrics.byStatus.resolved}/${metrics.total} closed`}
        />
        <Metric
          label="Active"
          value={String(metrics.byStatus.open + metrics.byStatus['in-progress'])}
          hint={`${metrics.byStatus['in-progress']} in progress`}
        />
        <Metric
          label="Top component"
          value={metrics.topComponent?.name ?? '—'}
          hint={
            metrics.topComponent
              ? `${metrics.topComponent.count} incident${metrics.topComponent.count === 1 ? '' : 's'}`
              : 'no data yet'
          }
        />
      </div>
    </div>
  )
}

function Metric({ label, value, hint, icon }: {
  label: string
  value: string
  hint: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3" style={{ background: 'var(--color-panel)' }}>
      <span className="field-label flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        className="truncate font-mono text-lg font-semibold leading-tight"
        style={{ color: 'var(--color-ink)' }}
        title={value}
      >
        {value}
      </span>
      <span className="truncate font-mono text-[10px]" style={{ color: 'var(--color-ink-faint)' }}>
        {hint}
      </span>
    </div>
  )
}
