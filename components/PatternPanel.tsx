'use client'
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Repeat, TriangleAlert } from 'lucide-react'
import type { Incident } from '@/lib/types'
import { detectPatterns, describePattern } from '@/lib/patterns'
import { severityTone, toneStyle } from '@/lib/severity'
import { formatRelative } from '@/lib/metrics'

export default function PatternPanel({ incidents }: { incidents: Incident[] }) {
  const [expanded, setExpanded] = useState(true)
  const patterns = useMemo(() => detectPatterns(incidents), [incidents])

  // Nothing recurring yet: a panel showing "none" would be noise.
  if (patterns.length === 0) return null

  const systemicCount = patterns.filter((pattern) => pattern.systemic).length

  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setExpanded((open) => !open)}
        className="panel-header w-full cursor-pointer text-left"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={13} color="var(--color-info)" />
        ) : (
          <ChevronRight size={13} color="var(--color-ink-faint)" />
        )}
        <Repeat size={13} color="var(--color-info)" />
        <span>pattern_detector.sh</span>

        {systemicCount > 0 && (
          <span
            className="chip"
            style={{
              color: '#ef4444',
              background: 'rgba(239,68,68,0.10)',
              borderColor: 'rgba(239,68,68,0.28)',
            }}
          >
            <TriangleAlert size={10} />
            {systemicCount} systemic
          </span>
        )}

        <span
          className="ml-auto font-mono text-[11px] font-normal"
          style={{ color: 'var(--color-ink-faint)' }}
        >
          {patterns.length} recurring
        </span>
      </button>

      {expanded && (
        <ul className="animate-slide-up divide-y" style={{ borderColor: 'var(--color-edge)' }}>
          {patterns.slice(0, 6).map((pattern) => {
            const tone = severityTone(pattern.severity)
            return (
              <li
                key={pattern.key}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
                style={{ borderColor: 'var(--color-edge)' }}
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-semibold"
                  style={toneStyle(tone)}
                >
                  {pattern.count}
                </span>

                <span
                  className="min-w-0 flex-1 truncate text-xs"
                  style={{ color: 'var(--color-ink)' }}
                  title={pattern.label}
                >
                  {pattern.label}
                </span>

                <span
                  className="chip"
                  style={{ color: 'var(--color-ink-dim)', borderColor: 'var(--color-edge-bright)' }}
                  title={
                    pattern.kind === 'repeat'
                      ? 'The same failure recurring on this component'
                      : 'This component failing in several different ways'
                  }
                >
                  {pattern.kind === 'repeat' ? <Repeat size={9} /> : <Layers size={9} />}
                  {pattern.kind}
                </span>

                {pattern.systemic && (
                  <span
                    className="chip"
                    style={{
                      color: '#ef4444',
                      background: 'rgba(239,68,68,0.10)',
                      borderColor: 'rgba(239,68,68,0.28)',
                    }}
                  >
                    systemic
                  </span>
                )}

                <span
                  className="font-mono text-[11px] whitespace-nowrap"
                  style={{ color: 'var(--color-ink-dim)' }}
                >
                  {describePattern(pattern)}
                </span>

                <span
                  className="font-mono text-[11px] whitespace-nowrap"
                  style={{ color: 'var(--color-ink-faint)' }}
                >
                  {pattern.unresolved > 0 ? `${pattern.unresolved} open · ` : ''}
                  last {formatRelative(pattern.lastSeen)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
