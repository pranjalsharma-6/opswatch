import { describe, expect, it } from 'vitest'
import { parseSseBuffer } from '../lib/triage-client'

describe('parseSseBuffer', () => {
  it('parses complete frames', () => {
    const { events, rest } = parseSseBuffer('data: {"type":"delta","content":"a"}\n\n')
    expect(events).toEqual([{ type: 'delta', content: 'a' }])
    expect(rest).toBe('')
  })

  it('holds back an incomplete trailing frame', () => {
    const { events, rest } = parseSseBuffer(
      'data: {"type":"delta","content":"a"}\n\ndata: {"type":"del'
    )
    expect(events).toHaveLength(1)
    expect(rest).toBe('data: {"type":"del')
  })

  it('reassembles a frame split across chunks', () => {
    const first = parseSseBuffer('data: {"type":"delta","con')
    expect(first.events).toEqual([])

    const second = parseSseBuffer(first.rest + 'tent":"hi"}\n\n')
    expect(second.events).toEqual([{ type: 'delta', content: 'hi' }])
  })

  it('parses several frames in one chunk', () => {
    const { events } = parseSseBuffer(
      'data: {"type":"delta","content":"a"}\n\ndata: {"type":"delta","content":"b"}\n\n'
    )
    expect(events).toHaveLength(2)
  })

  it('skips a malformed frame instead of aborting', () => {
    const { events } = parseSseBuffer('data: not-json\n\ndata: {"type":"done"}\n\n')
    expect(events).toEqual([{ type: 'done' }])
  })

  it('ignores non-data lines and blank payloads', () => {
    const { events } = parseSseBuffer(': keep-alive\n\ndata:\n\ndata: {"type":"done"}\n\n')
    expect(events).toEqual([{ type: 'done' }])
  })
})
