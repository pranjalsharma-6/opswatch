'use client'
import { useState } from 'react'
import { Loader2, Zap, Plus, Terminal, Upload } from 'lucide-react'
import { TriageResult, Incident } from '@/lib/types'

const SAMPLES: Record<string, string> = {
  'OOM Kill': `[ERROR] 2024-01-15 02:31:05 UTC - OOMKilled: container "api-server" exceeded memory limit 512Mi
[WARN]  2024-01-15 02:31:06 UTC - Pod "api-server-7d9f8b-xkp2q" restarting (attempt 4/5)
[ERROR] 2024-01-15 02:31:08 UTC - kubectl: CrashLoopBackOff detected on api-server
[ERROR] 2024-01-15 02:31:09 UTC - Node memory pressure: 94% used on node-03`,
  'DB Timeout': `[ERROR] 2024-01-15 08:12:44 UTC - psql: connection timeout after 30s
[ERROR] 2024-01-15 08:12:45 UTC - Too many connections: 512/512 (max_connections exceeded)
[WARN]  2024-01-15 08:12:46 UTC - PgBouncer pool exhausted for database "users_db"
[ERROR] 2024-01-15 08:12:48 UTC - API: 503 returned to 1247 requests in last 60s`,
  '502 Gateway': `[ERROR] 2024-01-15 14:05:22 UTC - nginx: upstream timed out /api/v2/orders
[ERROR] 2024-01-15 14:05:23 UTC - 502 Bad Gateway upstream: "http://orders-svc:8080"
[ERROR] 2024-01-15 14:05:25 UTC - Deployment "orders-svc" rollout stuck: ImagePullBackOff`,
  'Disk Full': `[ERROR] 2024-01-15 19:44:01 UTC - No space left on device: /var/log (usage: 100%)
[ERROR] 2024-01-15 19:44:02 UTC - MySQL: unable to write to disk InnoDB log flushing failed
[WARN]  2024-01-15 19:44:03 UTC - inotify limit reached: 8192 watchers`,
}

const SEV_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  warning:  { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  info:     { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
}

interface Props { onIncidentAdded: (incident: Incident) => void }

export default function LogInputPanel({ onIncidentAdded }: Props) {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function runTriage() {
    if (!logs.trim()) return
    setLoading(true); setResult(null); setError('')
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function saveIncident() {
    if (!result) return
    setSaving(true)
    try {
      const existing = await fetch('/api/incidents').then(r => r.json())
      const count = Array.isArray(existing) ? existing.length + 1 : 1
      const body = {
        incident_no: `INC-${String(count).padStart(3, '0')}`,
        ...result,
        log_snippet: logs.substring(0, 500),
        status: 'open',
      }
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const saved = await res.json()
      onIncidentAdded(saved)
      setResult(null); setLogs('')
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogs(ev.target?.result as string)
    reader.readAsText(file)
  }

  const sev = result ? SEV_STYLE[result.severity] : null

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <Terminal size={14} color="var(--accent-blue)" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>log_input.sh</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {['#ef4444','#f59e0b','#10b981'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Textarea */}
        <textarea
          value={logs}
          onChange={e => setLogs(e.target.value)}
          placeholder={`# Paste raw log output here...\n\n[ERROR] 2024-01-15 02:31:05 - OOMKilled\n[WARN]  2024-01-15 02:31:06 - CrashLoopBackOff\n[ERROR] 2024-01-15 02:31:08 - Node pressure 94%`}
          style={{
            width: '100%', height: 180,
            fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.7,
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: '#a8c0e8',
            padding: '12px 14px',
            resize: 'vertical',
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />

        {/* Upload */}
        <label style={{
  border: '1px dashed var(--border-bright)',
  borderRadius: 8, padding: '8px 12px',
  textAlign: 'center' as const,
  cursor: 'pointer',
  fontSize: 12, color: 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'background 0.15s',
}}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <input type="file" accept=".log,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
          <Upload size={12} />
          upload .log or .txt
        </label>

        {/* Samples */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>samples:</span>
          {Object.keys(SAMPLES).map(key => (
            <button key={key} onClick={() => setLogs(SAMPLES[key])} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              border: '1px solid var(--border-bright)',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)',
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue-glow)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Triage Button */}
        <button
          onClick={runTriage}
          disabled={loading || !logs.trim()}
          style={{
            width: '100%', padding: '10px',
            borderRadius: 8, border: 'none',
            background: loading || !logs.trim()
              ? 'var(--border)'
              : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            color: loading || !logs.trim() ? 'var(--text-muted)' : 'white',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            cursor: loading || !logs.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading || !logs.trim() ? 'none' : '0 0 20px rgba(59,130,246,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {loading
            ? <><Loader2 size={14} style={{ animation: 'spin 0.6s linear infinite' }} /> analyzing logs...</>
            : <><Zap size={14} /> run_ai_triage()</>
          }
        </button>

        {/* Error */}
        {error && (
          <div style={{
            fontSize: 12, color: '#ef4444',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '8px 12px',
            fontFamily: 'var(--font-mono)',
          }}>
            ✗ {error}
          </div>
        )}

        {/* AI Result */}
        {result && sev && (
          <div style={{
            border: `1px solid ${sev.border}`,
            borderRadius: 10,
            background: sev.bg,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 14px',
              borderBottom: `1px solid ${sev.border}`,
              fontSize: 11, fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: sev.color,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Zap size={11} /> triage_result.json
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>severity</p>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`,
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>{result.severity}</span>
              </div>
              {[
                { label: 'root_cause', val: result.root_cause },
                { label: 'impact',     val: result.impact },
                { label: 'fix',        val: result.fix },
              ].map(f => (
                <div key={f.label}>
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{f.label}</p>
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{f.val}</p>
                </div>
              ))}
              <button
                onClick={saveIncident}
                disabled={saving}
                style={{
                  width: '100%', padding: '8px',
                  borderRadius: 7, border: `1px solid ${sev.border}`,
                  background: sev.bg, color: sev.color,
                  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginTop: 2,
                }}
              >
                {saving ? <Loader2 size={12} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Plus size={12} />}
                {saving ? 'saving...' : '+ add_to_incident_log()'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}