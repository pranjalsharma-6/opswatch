'use client'
import { useCallback, useEffect, useState } from 'react'
import { Activity, Terminal, Wifi } from 'lucide-react'
import type { Incident, Status } from '@/lib/types'
import StatCards from '@/components/StatCards'
import LogInputPanel from '@/components/LogInputPanel'
import IncidentTable from '@/components/IncidentTable'
import PatternPanel from '@/components/PatternPanel'
import { ToastProvider, useToast } from '@/components/Toast'

export default function Page() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  )
}

function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [clock, setClock] = useState('')
  const toast = useToast()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/incidents')
        // The route returns an error object rather than an array on failure,
        // so the shape is checked instead of assumed.
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(payload?.error || `Could not load incidents (HTTP ${res.status})`)
        }
        if (!cancelled) setIncidents(Array.isArray(payload) ? payload : [])
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Could not load incidents'
        setLoadError(message)
        toast('error', message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [toast])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleIncidentAdded = useCallback((incident: Incident) => {
    setIncidents((prev) => [incident, ...prev])
  }, [])

  const handleStatusChange = useCallback(
    async (id: string, status: Status) => {
      const previous = incidents
      // Update optimistically so the click feels instant, then roll back on failure.
      setIncidents((prev) =>
        prev.map((incident) => (incident.id === id ? { ...incident, status } : incident))
      )

      try {
        const res = await fetch('/api/incidents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        })
        const payload = await res.json().catch(() => ({}) as { error?: string })
        if (!res.ok) throw new Error(payload.error || `Update failed (HTTP ${res.status})`)

        const updated = payload as Incident
        setIncidents((prev) => prev.map((incident) => (incident.id === id ? updated : incident)))
      } catch (e) {
        setIncidents(previous)
        toast('error', e instanceof Error ? e.message : 'Could not update the incident')
      }
    },
    [incidents, toast]
  )

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-50 flex h-[52px] items-center justify-between px-4 backdrop-blur-md sm:px-6"
        style={{ background: 'rgba(15,21,36,0.9)', borderBottom: '1px solid var(--color-edge)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
              boxShadow: '0 0 16px rgba(59,130,246,0.4)',
            }}
          >
            <Terminal size={16} color="white" />
          </div>
          <span className="font-mono text-[15px] font-semibold tracking-tight">OpsWatch</span>
          <span
            className="rounded border px-1.5 py-px font-mono text-[10px] tracking-wider"
            style={{
              color: 'var(--color-info)',
              background: 'rgba(59,130,246,0.15)',
              borderColor: 'rgba(59,130,246,0.3)',
            }}
          >
            v1.1
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-5">
          <div className="hidden items-center gap-1.5 sm:flex">
            <Activity size={13} color="var(--color-ok)" className="animate-pulse-dot" />
            <span className="font-mono text-xs" style={{ color: 'var(--color-ok)' }}>
              AI TRIAGE ONLINE
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi size={13} color="var(--color-ink-dim)" />
            {/* Rendered after mount only: a server-rendered clock would not match. */}
            <span
              className="font-mono text-xs tabular-nums"
              style={{ color: 'var(--color-ink-dim)' }}
              suppressHydrationWarning
            >
              {clock || '--:--:--'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5 sm:px-4">
        <div
          className="panel flex flex-wrap items-center gap-2 overflow-hidden px-4 py-2.5 font-mono text-[11px]"
          style={{ color: 'var(--color-ink-dim)' }}
        >
          <span style={{ color: 'var(--color-ok)' }}>●</span>
          <span style={{ color: 'var(--color-info)' }}>sys@opswatch</span>
          <span style={{ color: 'var(--color-ink-faint)' }}>~$</span>
          <span className="truncate">
            {loadError
              ? `error: ${loadError}`
              : 'monitoring all services — paste logs below to trigger AI incident triage'}
          </span>
          <span className="ml-auto whitespace-nowrap" style={{ color: 'var(--color-ink-faint)' }}>
            {incidents.length} incident{incidents.length === 1 ? '' : 's'} tracked
          </span>
        </div>

        <StatCards incidents={incidents} />

        <PatternPanel incidents={incidents} />

        <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
          <LogInputPanel onIncidentAdded={handleIncidentAdded} />
          <IncidentTable
            incidents={incidents}
            onStatusChange={handleStatusChange}
            loading={loading}
          />
        </div>
      </main>
    </div>
  )
}
