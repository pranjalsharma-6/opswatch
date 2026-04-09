'use client'
import { Incident } from '@/lib/types'

interface Props { incident: Incident }

export default function IncidentDrawer({ incident }: Props) {
  return (
    <div style={{
      background: 'rgba(59,130,246,0.03)',
      borderTop: '1px solid rgba(59,130,246,0.15)',
      padding: '16px 20px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { label: 'root_cause', val: incident.root_cause },
          { label: 'impact',     val: incident.impact },
        ].map(f => (
          <div key={f.label}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{f.label}</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-primary)' }}>{f.val}</p>
          </div>
        ))}
        <div style={{ gridColumn: '1 / -1' }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>suggested_fix</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{incident.fix}</p>
        </div>
        {incident.log_snippet && (
          <div style={{ gridColumn: '1 / -1' }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>log_snippet</p>
            <pre style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px',
              lineHeight: 1.7, color: '#6b9fd4',
              overflowX: 'auto', maxHeight: 100,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{incident.log_snippet}</pre>
          </div>
        )}
      </div>
    </div>
  )
}