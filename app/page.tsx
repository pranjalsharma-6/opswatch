'use client'
import { useState, useEffect } from 'react'
import { Incident } from '@/lib/types'
import StatCards from '@/components/StatCards'
import LogInputPanel from '@/components/LogInputPanel'
import IncidentTable from '@/components/IncidentTable'
import { Activity, Terminal, Wifi } from 'lucide-react'

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [time, setTime] = useState('')

  useEffect(() => {
    fetch('/api/incidents')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setIncidents(data) })
  }, [])

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  function handleIncidentAdded(incident: Incident) {
    setIncidents(prev => [incident, ...prev])
  }

  async function handleStatusChange(id: string, status: Incident['status']) {
    const res = await fetch('/api/incidents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const updated = await res.json()
    setIncidents(prev => prev.map(inc => inc.id === id ? updated : inc))
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* TOP BAR */}
      <header style={{
        background: 'rgba(15,21,36,0.9)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        padding: '0 24px',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(59,130,246,0.4)'
          }}>
            <Terminal size={16} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 15, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
            OpsWatch
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--accent-blue)',
            background: 'var(--accent-blue-glow)',
            border: '1px solid rgba(59,130,246,0.3)',
            padding: '2px 6px', borderRadius: 4,
            letterSpacing: '0.05em'
          }}>v1.0</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={13} color="var(--accent-green)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-green)' }}>
              AI TRIAGE ONLINE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wifi size={13} color="var(--text-secondary)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
              {time}
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* SYSTEM STATUS BAR */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
        }}>
          <span style={{ color: 'var(--accent-green)', marginRight: 4 }}>●</span>
          <span style={{ color: 'var(--accent-blue)' }}>sys@opswatch</span>
          <span style={{ color: 'var(--text-muted)' }}>~$</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            monitoring all services — paste logs below to trigger AI incident triage
          </span>
          <span style={{
            marginLeft: 'auto',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap'
          }}>
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} tracked
          </span>
        </div>

        <StatCards incidents={incidents} />

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
          <LogInputPanel onIncidentAdded={handleIncidentAdded} />
          <IncidentTable incidents={incidents} onStatusChange={handleStatusChange} />
        </div>
      </main>
    </div>
  )
}