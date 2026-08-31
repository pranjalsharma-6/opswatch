import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MODEL_CHAIN,
  getGroqClient,
  getModelChain,
  isModelUnavailableError,
  resetGroqClient,
} from '../lib/groq'

afterEach(() => {
  delete process.env.GROQ_MODEL
  delete process.env.GROQ_API_KEY
  resetGroqClient()
})

describe('getGroqClient', () => {
  it('throws an actionable error instead of crashing at import time', () => {
    // Regression: the client used to be constructed at module scope, so a
    // missing key failed `next build` during page-data collection.
    resetGroqClient()
    expect(() => getGroqClient()).toThrow(/GROQ_API_KEY is not set/)
  })

  it('builds a client when the key is present', () => {
    process.env.GROQ_API_KEY = 'test-key'
    resetGroqClient()
    expect(getGroqClient()).toBeTruthy()
  })
})

describe('getModelChain', () => {
  it('defaults to the built-in chain', () => {
    expect(getModelChain()).toEqual([...DEFAULT_MODEL_CHAIN])
  })

  it('puts an override first and keeps the defaults as fallbacks', () => {
    process.env.GROQ_MODEL = 'some-new-model'
    const chain = getModelChain()
    expect(chain[0]).toBe('some-new-model')
    expect(chain).toHaveLength(DEFAULT_MODEL_CHAIN.length + 1)
  })

  it('does not duplicate an override that is already in the chain', () => {
    process.env.GROQ_MODEL = DEFAULT_MODEL_CHAIN[1]
    const chain = getModelChain()
    expect(chain).toHaveLength(DEFAULT_MODEL_CHAIN.length)
    expect(new Set(chain).size).toBe(chain.length)
  })
})

describe('isModelUnavailableError', () => {
  it('detects a retired model', () => {
    expect(isModelUnavailableError({ status: 404, message: 'model not found' })).toBe(true)
    expect(isModelUnavailableError(new Error('The model `mixtral` has been decommissioned'))).toBe(true)
    expect(isModelUnavailableError(new Error('model `x` does not exist'))).toBe(true)
  })

  it('does not misclassify unrelated failures', () => {
    // Regression: a substring check for "model" turned every error mentioning
    // the word into a misleading "Model unavailable" message.
    expect(isModelUnavailableError(new Error('rate limit exceeded'))).toBe(false)
    expect(isModelUnavailableError({ status: 401, message: 'invalid api key' })).toBe(false)
  })
})
