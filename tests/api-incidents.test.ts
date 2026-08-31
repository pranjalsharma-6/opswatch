import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal PostgREST-shaped query builder covering the calls the route makes. */
function makeSupabaseMock() {
  const state = { rows: [] as Record<string, unknown>[], error: null as { message: string } | null }

  const builder = () => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    for (const method of ['select', 'order', 'limit', 'insert', 'update', 'eq']) {
      chain[method] = vi.fn(self)
    }
    chain.single = vi.fn(async () => ({ data: state.rows[0] ?? null, error: state.error }))
    // Awaiting the builder directly resolves the list form.
    chain.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: state.rows, error: state.error })
    return chain
  }

  return { state, from: vi.fn(builder) }
}

const supabase = makeSupabaseMock()
vi.mock('../lib/supabase-server', () => ({ getSupabase: () => supabase }))
vi.mock('@/lib/supabase-server', () => ({ getSupabase: () => supabase }))

import { GET, PATCH, POST } from '../app/api/incidents/route'

function request(method: string, body?: unknown) {
  return new Request('http://localhost/api/incidents', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never
}

const TRIAGE = {
  severity: 'critical',
  title: 'OOMKilled',
  root_cause: 'memory',
  impact: 'down',
  fix: '1. fix',
  component: 'api',
  log_snippet: '[ERROR]',
}

beforeEach(() => {
  supabase.state.rows = []
  supabase.state.error = null
  supabase.from.mockClear()
})

describe('GET /api/incidents', () => {
  it('returns the incident list', async () => {
    supabase.state.rows = [{ id: '1', incident_no: 'INC-001' }]
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toHaveLength(1)
  })

  it('surfaces a database error as a 500', async () => {
    supabase.state.error = { message: 'connection refused' }
    const res = await GET()
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toMatchObject({ error: 'connection refused' })
  })
})

describe('POST /api/incidents', () => {
  it('creates an incident', async () => {
    supabase.state.rows = [{ id: '1', incident_no: 'INC-001' }]
    const res = await POST(request('POST', TRIAGE))
    expect(res.status).toBe(201)
  })

  it('never accepts a client-supplied incident_no', async () => {
    // Regression: the number used to be computed client-side from the row
    // count, so two concurrent saves produced duplicates.
    supabase.state.rows = [{ id: '1', incident_no: 'INC-001' }]
    const insert = vi.fn()
    supabase.from.mockImplementationOnce(() => {
      const chain: Record<string, unknown> = {}
      chain.insert = (row: unknown) => {
        insert(row)
        return chain
      }
      chain.select = () => chain
      chain.single = async () => ({ data: { id: '1' }, error: null })
      return chain
    })

    await POST(request('POST', { ...TRIAGE, incident_no: 'INC-999' }))
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0]).not.toHaveProperty('incident_no')
  })

  it('rejects an invalid severity', async () => {
    const res = await POST(request('POST', { ...TRIAGE, severity: 'apocalyptic' }))
    expect(res.status).toBe(400)
  })

  it('rejects a missing title', async () => {
    const res = await POST(request('POST', { ...TRIAGE, title: '   ' }))
    expect(res.status).toBe(400)
  })

  it('forces new incidents to open status regardless of input', async () => {
    const insert = vi.fn()
    supabase.from.mockImplementationOnce(() => {
      const chain: Record<string, unknown> = {}
      chain.insert = (row: unknown) => {
        insert(row)
        return chain
      }
      chain.select = () => chain
      chain.single = async () => ({ data: { id: '1' }, error: null })
      return chain
    })
    await POST(request('POST', { ...TRIAGE, status: 'resolved' }))
    expect(insert.mock.calls[0][0]).toMatchObject({ status: 'open' })
  })
})

describe('PATCH /api/incidents', () => {
  it('updates a status', async () => {
    supabase.state.rows = [{ id: '1', status: 'resolved' }]
    const res = await PATCH(request('PATCH', { id: '1', status: 'resolved' }))
    expect(res.status).toBe(200)
  })

  it('rejects an unknown status', async () => {
    const res = await PATCH(request('PATCH', { id: '1', status: 'exploded' }))
    expect(res.status).toBe(400)
  })

  it('rejects a missing id', async () => {
    const res = await PATCH(request('PATCH', { status: 'open' }))
    expect(res.status).toBe(400)
  })

  it('stamps resolved_at when resolving and clears it otherwise', async () => {
    const update = vi.fn()
    const stub = () => {
      const chain: Record<string, unknown> = {}
      chain.update = (row: unknown) => {
        update(row)
        return chain
      }
      chain.eq = () => chain
      chain.select = () => chain
      chain.single = async () => ({ data: { id: '1' }, error: null })
      return chain
    }

    supabase.from.mockImplementationOnce(stub)
    await PATCH(request('PATCH', { id: '1', status: 'resolved' }))
    expect(update.mock.calls[0][0].resolved_at).toBeTruthy()

    supabase.from.mockImplementationOnce(stub)
    await PATCH(request('PATCH', { id: '1', status: 'open' }))
    expect(update.mock.calls[1][0].resolved_at).toBeNull()
  })
})
