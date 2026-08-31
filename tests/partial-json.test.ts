import { describe, expect, it } from 'vitest'
import { parsePartialJson, partialFields } from '../lib/partial-json'

describe('parsePartialJson', () => {
  it('parses complete JSON unchanged', () => {
    expect(parsePartialJson('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' })
  })

  it('returns undefined for empty input', () => {
    expect(parsePartialJson('')).toBeUndefined()
    expect(parsePartialJson('   ')).toBeUndefined()
  })

  it('closes an unterminated object', () => {
    expect(parsePartialJson('{"a":"x"')).toEqual({ a: 'x' })
  })

  it('closes an unterminated string, keeping the prefix', () => {
    expect(parsePartialJson('{"title":"Container OOM')).toEqual({ title: 'Container OOM' })
  })

  it('drops a key that has no value yet', () => {
    expect(parsePartialJson('{"a":"x","b":')).toEqual({ a: 'x' })
    expect(parsePartialJson('{"a":"x","b"')).toEqual({ a: 'x' })
    expect(parsePartialJson('{"a":"x",')).toEqual({ a: 'x' })
  })

  it('handles escaped quotes and newlines inside a streaming string', () => {
    expect(parsePartialJson('{"fix":"1. say \\"hi\\"\\n2. go')).toEqual({
      fix: '1. say "hi"\n2. go',
    })
  })

  it('does not emit a broken escape when the text ends on a backslash', () => {
    // A trailing backslash would otherwise escape the closing quote.
    expect(parsePartialJson('{"fix":"step\\')).toEqual({ fix: 'step' })
  })

  it('handles nested objects and arrays', () => {
    expect(parsePartialJson('{"a":{"b":[1,2')).toEqual({ a: { b: [1, 2] } })
  })

  it('returns undefined when nothing parseable has arrived', () => {
    expect(parsePartialJson('not json at all')).toBeUndefined()
  })

  it('parses every prefix of a realistic streamed response', () => {
    const full = JSON.stringify({
      severity: 'critical',
      title: 'Container OOMKilled',
      root_cause: 'memory limit exceeded',
      impact: 'API down',
      fix: '1. Raise limit\n2. Redeploy',
      component: 'api-server',
    })

    // Every prefix must either parse to an object or report not-ready —
    // it must never throw.
    for (let i = 1; i <= full.length; i++) {
      const result = parsePartialJson(full.slice(0, i))
      if (result !== undefined) expect(typeof result).toBe('object')
    }
    expect(parsePartialJson(full)).toMatchObject({ severity: 'critical' })
  })
})

describe('partialFields', () => {
  const KEYS = ['severity', 'title', 'fix'] as const

  it('returns only the string fields that have arrived', () => {
    expect(partialFields('{"severity":"critical","title":"OOM', KEYS)).toEqual({
      severity: 'critical',
      title: 'OOM',
    })
  })

  it('ignores non-string and empty values', () => {
    expect(partialFields('{"severity":"","title":42,"fix":"1. go"}', KEYS)).toEqual({
      fix: '1. go',
    })
  })

  it('returns an empty object when nothing has arrived', () => {
    expect(partialFields('', KEYS)).toEqual({})
    expect(partialFields('garbage', KEYS)).toEqual({})
  })
})
