import { NextResponse, type NextRequest } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { ConfigError } from '@/lib/errors'
import { STATUSES, type Status } from '@/lib/types'
import { SEVERITIES } from '@/lib/triage'

/** Incident data is per-request state; never serve a cached list. */
export const dynamic = 'force-dynamic'

const MAX_LOG_SNIPPET = 2_000
const MAX_FIELD = 2_000

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (error) {
    return handleConfigError(error)
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const text = (value: unknown, max = MAX_FIELD): string =>
    typeof value === 'string' ? value.trim().slice(0, max) : ''

  const severity = text(body.severity).toLowerCase()
  if (!SEVERITIES.includes(severity as never)) {
    return NextResponse.json(
      { error: `severity must be one of: ${SEVERITIES.join(', ')}` },
      { status: 400 }
    )
  }

  const title = text(body.title, 200)
  if (!title) return NextResponse.json({ error: 'title is required.' }, { status: 400 })

  // incident_no is intentionally omitted: the database assigns it from a
  // sequence. Deriving it client-side from the current row count raced, and
  // two concurrent saves produced duplicate numbers.
  const row = {
    severity,
    title,
    root_cause: text(body.root_cause),
    impact: text(body.impact),
    fix: text(body.fix),
    component: text(body.component, 120) || 'unknown',
    log_snippet: text(body.log_snippet, MAX_LOG_SNIPPET),
    status: 'open' satisfies Status,
  }

  try {
    const { data, error } = await getSupabase().from('incidents').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return handleConfigError(error)
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const status = typeof body.status === 'string' ? body.status.trim() : ''

  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })
  if (!STATUSES.includes(status as Status)) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Stamp resolved_at so mean-time-to-resolution can be computed from the row.
  const patch = {
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null,
  }

  try {
    const { data, error } = await getSupabase()
      .from('incidents')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Incident not found.' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    return handleConfigError(error)
  }
}

function handleConfigError(error: unknown) {
  if (error instanceof ConfigError) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const message = error instanceof Error ? error.message : 'Unexpected error'
  return NextResponse.json({ error: message }, { status: 500 })
}
