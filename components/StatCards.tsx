'use client'
import { Incident } from '@/lib/types'
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'

interface Props { incidents: Incident[] }

export default function StatCards({ incidents }: Props) {
  const stats = [
    {
      label: 'Critical',
      value: incidents.filter(i => i.severity === 'critical').length,
      icon: AlertTriangle,
      color: '#ef4444',
      glow: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.25)',
      topBar: '#ef4444',
    },
    {
      label: 'Warning',
      value: incidents.filter(i => i.severity === 'warning').length,
      icon: AlertCircle,
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.25)',
      topBar: '#f59e0b',
    },
    {
      label: 'Info',
      value: incidents.filter(i => i.severity === 'info').length,
      icon: Info,
      color: '#3b82f6',
      glow: 'rgba(59,130,246,0.12)',
      border: 'rgba(59,130,246,0.25)',
      topBar: '#3b82f6',
    },
    {
      label: 'Resolved',
      value: incidents.filter(i => i.status === 'resolved').length,
      icon: CheckCircle,
      color: '#10b981',
      glow: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.25)',
      topBar: '#10b981',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {stats.map(s => {
        const Icon = s.icon
        return (
          <div key={s.label} style={{
            background: s.value > 0 ? s.glow : 'var(--bg-card)',
            border: `1px solid ${s.value > 0 ? s.border : 'var(--border)'}`,
            borderTop: `2px solid ${s.value > 0 ? s.topBar : 'var(--border)'}`,
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
          }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-secondary)',
                marginBottom: 8,
              }}>{s.label}</p>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 32,
                fontWeight: 600,
                color: s.value > 0 ? s.color : 'var(--text-muted)',
                lineHeight: 1,
                transition: 'color 0.3s',
              }}>{s.value}</p>
            </div>
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              background: s.value > 0 ? s.glow : 'transparent',
              border: `1px solid ${s.value > 0 ? s.border : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color={s.value > 0 ? s.color : 'var(--text-muted)'} />
            </div>
          </div>
        )
      })}
    </div>
  )
}