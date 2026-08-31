'use client'
import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Search } from 'lucide-react'
import type { Incident, Severity, Status } from '@/lib/types'
import { NEXT_STATUS, severityTone, statusTone, toneStyle } from '@/lib/severity'
import { formatRelative, toCsv } from '@/lib/metrics'
import IncidentDrawer from './IncidentDrawer'

interface Props {
  incidents: Incident[]
  onStatusChange: (id: string, status: Status) => void
  loading?: boolean
}

type Filter = 'All' | 'Critical' | 'Warning' | 'Info' | 'Open' | 'Resolved'
const FILTERS: Filter[] = ['All', 'Critical', 'Warning', 'Info', 'Open', 'Resolved']

const SEVERITY_FILTERS: Partial<Record<Filter, Severity>> = {
  Critical: 'critical',
  Warning: 'warning',
  Info: 'info',
}
const STATUS_FILTERS: Partial<Record<Filter, Status>> = {
  Open: 'open',
  Resolved: 'resolved',
}

export default function IncidentTable({ incidents, onStatusChange, loading = false }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return incidents.filter((incident) => {
      const severity = SEVERITY_FILTERS[filter]
      if (severity && incident.severity !== severity) return false
      const status = STATUS_FILTERS[filter]
      if (status && incident.status !== status) return false
      if (!query) return true
      return [incident.title, incident.component, incident.root_cause, incident.incident_no]
        .some((field) => field?.toLowerCase().includes(query))
    })
  }, [incidents, filter, search])

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `opswatch-incidents-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header flex-wrap">
        <span>
          incident_log<span style={{ color: 'var(--color-ink-faint)', fontWeight: 400 }}>.db</span>
        </span>
        <span
          className="rounded border px-1.5 py-px font-mono text-[11px]"
          style={{
            color: 'var(--color-info)',
            background: 'rgba(59,130,246,0.15)',
            borderColor: 'rgba(59,130,246,0.2)',
          }}
        >
          {filtered.length} rows
        </span>

        <div className="relative ml-auto min-w-[140px] max-w-[240px] flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-ink-faint)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search incidents..."
            aria-label="Search incidents"
            className="input-base h-[30px] w-full pl-7 pr-2.5 text-[11.5px] focus:border-[var(--color-edge-bright)]"
          />
        </div>

        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          title="Export the filtered rows as CSV"
          className="flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: 'var(--color-edge-bright)', color: 'var(--color-ink-dim)' }}
        >
          <Download size={11} />
          csv
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-4 py-2.5" style={{ borderColor: 'var(--color-edge)' }}>
        {FILTERS.map((option) => {
          const active = filter === option
          return (
            <button
              key={option}
              onClick={() => setFilter(option)}
              aria-pressed={active}
              className="cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-all"
              style={{
                borderColor: active ? 'rgba(59,130,246,0.5)' : 'var(--color-edge)',
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? 'var(--color-info)' : 'var(--color-ink-dim)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {option}
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr style={{ background: 'rgb(255 255 255 / 0.02)', borderBottom: '1px solid var(--color-edge)' }}>
              {['', 'ID', 'Severity', 'Summary', 'Status', 'Component', 'Age'].map((heading) => (
                <th
                  key={heading || 'expand'}
                  scope="col"
                  // Summary absorbs the free width so the other columns stay
                  // content-sized instead of the title truncating early.
                  className={`whitespace-nowrap px-3.5 py-2 text-left text-[10px] font-medium uppercase tracking-[0.1em] ${
                    heading === 'Summary' ? 'w-full' : ''
                  }`}
                  style={{ color: 'var(--color-ink-faint)' }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-xs" style={{ color: 'var(--color-ink-faint)' }}>
                  {'// loading incidents...'}
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-xs" style={{ color: 'var(--color-ink-faint)' }}>
                  {incidents.length === 0
                    ? '// no incidents yet — paste logs and run_ai_triage()'
                    : '// no matching results'}
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((incident) => {
                const tone = severityTone(incident.severity)
                const status = statusTone(incident.status)
                const expanded = expandedId === incident.id

                return (
                  // The key belongs on the Fragment: putting it on the inner <tr>
                  // left the list itself unkeyed and broke row reconciliation.
                  <Fragment key={incident.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : incident.id)}
                      className="cursor-pointer transition-colors hover:bg-[var(--color-panel-hover)]"
                      style={{
                        borderBottom: '1px solid var(--color-edge)',
                        background: expanded ? 'rgba(59,130,246,0.05)' : undefined,
                      }}
                    >
                      <td className="w-8 px-3.5 py-2.5">
                        {expanded ? (
                          <ChevronDown size={13} color="var(--color-info)" />
                        ) : (
                          <ChevronRight size={13} color="var(--color-ink-faint)" />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-[11px]" style={{ color: 'var(--color-ink-dim)' }}>
                        {incident.incident_no}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="chip" style={toneStyle(tone)}>
                          <span className="size-1.5 rounded-full" style={{ background: tone.text }} />
                          {incident.severity}
                        </span>
                      </td>
                      <td
                        className="max-w-0 truncate px-3.5 py-2.5 text-xs"
                        style={{ color: 'var(--color-ink)' }}
                        title={incident.title}
                      >
                        {incident.title}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(incident.id, NEXT_STATUS[incident.status])
                          }}
                          className="chip cursor-pointer transition-opacity hover:opacity-70"
                          style={toneStyle(status)}
                          title={`Click to mark as ${NEXT_STATUS[incident.status]}`}
                        >
                          {incident.status}
                        </button>
                      </td>
                      <td
                        className="max-w-[120px] truncate px-3.5 py-2.5 text-[11px]"
                        style={{ color: 'var(--color-ink-dim)' }}
                        title={incident.component}
                      >
                        {incident.component}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
                        {formatRelative(incident.created_at)}
                      </td>
                    </tr>

                    {expanded && (
                      <tr style={{ borderBottom: '1px solid var(--color-edge)' }}>
                        <td colSpan={7} className="p-0">
                          <IncidentDrawer incident={incident} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
