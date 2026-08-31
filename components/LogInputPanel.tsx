'use client'
import { useRef, useState } from 'react'
import { Loader2, Plus, Terminal, Upload, Zap } from 'lucide-react'
import type { Incident, TriageResult } from '@/lib/types'
import { MAX_LOG_CHARS } from '@/lib/triage'
import { severityTone, toneStyle } from '@/lib/severity'
import { streamTriage } from '@/lib/triage-client'
import { useToast } from './Toast'

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
  'Redis Down': `[ERROR] 2024-01-15 11:02:14 UTC - redis: CLUSTERDOWN Hash slot not served
[ERROR] 2024-01-15 11:02:15 UTC - Circuit breaker OPEN for cache-tier after 50 consecutive failures
[WARN]  2024-01-15 11:02:16 UTC - Falling back to origin DB: read latency p99 2400ms`,
  'Scale Out': `[INFO] 2024-01-15 09:15:02 UTC - HPA: scaling "web" from 4 to 9 replicas (CPU 82% > target 60%)
[INFO] 2024-01-15 09:15:41 UTC - All 9 replicas Ready
[INFO] 2024-01-15 09:16:00 UTC - Request latency p95 recovered to 180ms`,
}

interface Props {
  onIncidentAdded: (incident: Incident) => void
}

export default function LogInputPanel({ onIncidentAdded }: Props) {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  // Fields arriving mid-stream, before the validated result lands.
  const [partial, setPartial] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const overLimit = logs.length > MAX_LOG_CHARS

  async function runTriage() {
    if (!logs.trim() || overLimit) return
    setLoading(true)
    setResult(null)
    setPartial({})
    setError('')

    try {
      await streamTriage(logs, {
        onPartial: setPartial,
        onDone: (triaged) => {
          setResult(triaged)
          setPartial({})
          toast('success', 'Triage complete')
        },
        onError: (message) => {
          setError(message)
          toast('error', message)
        },
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong'
      setError(message)
      toast('error', message)
    } finally {
      setLoading(false)
    }
  }

  async function saveIncident() {
    if (!result) return
    setSaving(true)

    try {
      // incident_no is assigned by the database sequence, not derived here:
      // computing it from the current row count raced between concurrent saves.
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result, log_snippet: logs.slice(0, 2000) }),
      })

      const payload = await res.json().catch(() => ({}) as { error?: string })
      if (!res.ok) throw new Error(payload.error || `Save failed (HTTP ${res.status})`)

      onIncidentAdded(payload as Incident)
      setResult(null)
      setPartial({})
      setLogs('')
      toast('success', `Saved ${(payload as Incident).incident_no}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save the incident'
      setError(message)
      toast('error', message)
    } finally {
      setSaving(false)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => setLogs(String(event.target?.result ?? ''))
    reader.onerror = () => toast('error', `Could not read ${file.name}`)
    reader.readAsText(file)
    // Reset so re-selecting the same file fires change again.
    if (fileInput.current) fileInput.current.value = ''
  }

  const streaming = loading && Object.keys(partial).length > 0
  const shown = result ?? (streaming ? partial : null)
  const tone = shown ? severityTone(String(shown.severity ?? 'info')) : null

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">
        <Terminal size={14} color="var(--color-info)" />
        <span>log_input.sh</span>
        <div className="ml-auto flex gap-1.5">
          {['#ef4444', '#f59e0b', '#10b981'].map((color) => (
            <span key={color} className="size-2.5 rounded-full opacity-70" style={{ background: color }} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="relative">
          <textarea
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
            aria-label="Raw server logs"
            placeholder={`# Paste raw log output here...\n\n[ERROR] 2024-01-15 02:31:05 - OOMKilled\n[WARN]  2024-01-15 02:31:06 - CrashLoopBackOff`}
            className="input-base h-44 w-full resize-y px-3.5 py-3 text-[11.5px] leading-[1.7] focus:border-[var(--color-edge-bright)]"
            style={{ color: '#a8c0e8' }}
          />
          {logs.length > 0 && (
            <span
              className="pointer-events-none absolute bottom-2.5 right-3 font-mono text-[10px]"
              style={{ color: overLimit ? '#ef4444' : 'var(--color-ink-faint)' }}
            >
              {logs.length.toLocaleString()} / {MAX_LOG_CHARS.toLocaleString()}
            </span>
          )}
        </div>

        <label
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 font-mono text-xs transition-colors hover:bg-white/[0.03]"
          style={{ borderColor: 'var(--color-edge-bright)', color: 'var(--color-ink-dim)' }}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".log,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Upload size={12} />
          upload .log or .txt
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px]" style={{ color: 'var(--color-ink-faint)' }}>
            samples:
          </span>
          {Object.keys(SAMPLES).map((name) => (
            <button
              key={name}
              onClick={() => setLogs(SAMPLES[name])}
              className="cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-all hover:border-[rgba(59,130,246,0.4)] hover:bg-[rgba(59,130,246,0.15)] hover:text-[var(--color-info)]"
              style={{ borderColor: 'var(--color-edge-bright)', color: 'var(--color-ink-dim)' }}
            >
              {name}
            </button>
          ))}
        </div>

        <button
          onClick={runTriage}
          disabled={loading || !logs.trim() || overLimit}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-mono text-[13px] font-semibold text-white transition-all disabled:cursor-not-allowed"
          style={
            loading || !logs.trim() || overLimit
              ? { background: 'var(--color-edge)', color: 'var(--color-ink-faint)' }
              : {
                  background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                  boxShadow: '0 0 20px rgba(59,130,246,0.3)',
                }
          }
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin-slow" /> analyzing logs...
            </>
          ) : (
            <>
              <Zap size={14} /> run_ai_triage()
            </>
          )}
        </button>

        {error && (
          <div
            className="rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed"
            style={{
              color: '#ef4444',
              background: 'rgba(239,68,68,0.1)',
              borderColor: 'rgba(239,68,68,0.3)',
            }}
            role="alert"
          >
            ✗ {error}
          </div>
        )}

        {shown && tone && (
          <div
            className="animate-slide-up overflow-hidden rounded-[10px] border"
            style={{ borderColor: tone.border, background: tone.bg }}
          >
            <div
              className="flex items-center gap-1.5 px-3.5 py-2 font-mono text-[11px] font-semibold"
              style={{ borderBottom: `1px solid ${tone.border}`, color: tone.text }}
            >
              <Zap size={11} /> triage_result.json
              {streaming && (
                <span className="ml-auto flex items-center gap-1 font-normal opacity-80">
                  <Loader2 size={10} className="animate-spin-slow" />
                  streaming
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2.5 p-3.5">
              {shown.severity && (
                <div>
                  <p className="field-label mb-1">severity</p>
                  <span className="chip" style={toneStyle(tone)}>
                    {shown.severity}
                  </span>
                </div>
              )}

              {(['title', 'root_cause', 'impact', 'fix', 'component'] as const).map((label) => {
                const value = shown[label]
                // A field renders only once text for it has arrived, so the
                // panel grows downwards instead of flashing empty rows.
                if (!value) return null
                return (
                  <div key={label}>
                    <p className="field-label mb-1">{label}</p>
                    <p
                      className="whitespace-pre-line text-xs leading-relaxed"
                      style={{ color: 'var(--color-ink)' }}
                    >
                      {value}
                      {streaming && (
                        <span
                          className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse-dot"
                          style={{ background: tone.text }}
                        />
                      )}
                    </p>
                  </div>
                )
              })}

              {/* Saving is only offered once the server-validated result lands. */}
              {result && (
                <button
                  onClick={saveIncident}
                  disabled={saving}
                  className="mt-0.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                  style={toneStyle(tone)}
                >
                  {saving ? <Loader2 size={12} className="animate-spin-slow" /> : <Plus size={12} />}
                  {saving ? 'saving...' : 'add_to_incident_log()'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
