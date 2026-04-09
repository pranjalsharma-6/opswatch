'use client'
import { useState } from 'react'
import { Incident } from '@/lib/types'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import IncidentDrawer from './IncidentDrawer'

interface Props {
  incidents: Incident[]
  onStatusChange: (id: string, status: Incident['status']) => void
}

const SEV: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  dot: '#ef4444' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', dot: '#f59e0b' },
  info:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', dot: '#3b82f6' },
}
const STA: Record<string, { color: string; bg: string; border: string }> = {
  'open':        { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)' },
  'in-progress': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  'resolved':    { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
}
const STATUS_CYCLE: Record<string, Incident['status']> = {
  'open': 'in-progress', 'in-progress': 'resolved', 'resolved': 'open'
}
const FILTERS = ['All', 'Critical', 'Warning', 'Open', 'Resolved']

export default function IncidentTable({ incidents, onStatusChange }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = incidents
    .filter(inc => {
      if (filter === 'Critical') return inc.severity === 'critical'
      if (filter === 'Warning')  return inc.severity === 'warning'
      if (filter === 'Open')     return inc.status === 'open'
      if (filter === 'Resolved') return inc.status === 'resolved'
      return true
    })
    .filter(inc => !search || [inc.title, inc.component, inc.root_cause]
      .some(f => f?.toLowerCase().includes(search.toLowerCase())))

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, marginRight: 4 }}>
          incident_log
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>.db</span>
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--accent-blue)', background: 'var(--accent-blue-glow)',
          border: '1px solid rgba(59,130,246,0.2)',
          padding: '1px 6px', borderRadius: 4,
        }}>{filtered.length} rows</span>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 140, maxWidth: 240, marginLeft: 'auto' }}>
          <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search incidents..."
            style={{
              width: '100%', paddingLeft: 28, paddingRight: 10, height: 30,
              fontFamily: 'var(--font-mono)', fontSize: 11.5,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              fontFamily: 'var(--font-mono)',
              border: filter === f ? '1px solid rgba(59,130,246,0.5)' : '1px solid var(--border)',
              background: filter === f ? 'var(--accent-blue-glow)' : 'transparent',
              color: filter === f ? 'var(--accent-blue)' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: filter === f ? 600 : 400,
              transition: 'all 0.12s',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
              {['', 'ID', 'Severity', 'Summary', 'Status', 'Component'].map(h => (
                <th key={h} style={{
                  padding: '8px 14px', textAlign: 'left',
                  fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  width: h === '' ? 32 : h === 'ID' ? 90 : h === 'Severity' ? 100 : h === 'Status' ? 110 : h === 'Component' ? 120 : 'auto',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {incidents.length === 0 ? '// no incidents yet — paste logs and run_ai_triage()' : '// no matching results'}
                </td>
              </tr>
            )}
            {filtered.map(inc => {
              const s = SEV[inc.severity] || SEV.info
              const st = STA[inc.status] || STA.open
              const isOpen = selectedId === inc.id
              return (
                <>
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedId(isOpen ? null : inc.id)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isOpen ? 'rgba(59,130,246,0.05)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 14px', width: 32 }}>
                      {isOpen
                        ? <ChevronDown size={13} color="var(--accent-blue)" />
                        : <ChevronRight size={13} color="var(--text-muted)" />}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11 }}>{inc.incident_no}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                        {inc.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontSize: 12 }}>
                      {inc.title}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); onStatusChange(inc.id, STATUS_CYCLE[inc.status]) }}
                        style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                          cursor: 'pointer', fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          transition: 'opacity 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        title="click to cycle status"
                      >
                        {inc.status}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.component}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${inc.id}-drawer`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <IncidentDrawer incident={inc} />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}