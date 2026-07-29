import type { Event, EventHint } from '@sentry/react'
import { describe, expect, it } from 'vitest'
import { shouldDropSentryEvent } from './sentry-event-filter'

const TURNSTILE_MESSAGE = '[Cloudflare Turnstile] Error: 300010.'

function hint(originalException?: unknown): EventHint {
  return { originalException }
}

describe('shouldDropSentryEvent', () => {
  it('drops the verified Turnstile 300010 exception payload', () => {
    const event: Event = {
      exception: {
        values: [{ type: 'TurnstileError', value: TURNSTILE_MESSAGE }],
      },
    }

    expect(shouldDropSentryEvent(event, hint())).toBe(true)
  })

  it('drops the same exception when Sentry exposes it through the hint', () => {
    const originalException = Object.assign(new Error(TURNSTILE_MESSAGE), {
      name: 'TurnstileError',
    })

    expect(shouldDropSentryEvent({}, hint(originalException))).toBe(true)
  })

  it('keeps similar errors with a different type or Turnstile code', () => {
    const wrongType: Event = {
      exception: {
        values: [{ type: 'Error', value: TURNSTILE_MESSAGE }],
      },
    }
    const differentCode: Event = {
      exception: {
        values: [{ type: 'TurnstileError', value: '[Cloudflare Turnstile] Error: 300020.' }],
      },
    }

    expect(shouldDropSentryEvent(wrongType, hint())).toBe(false)
    expect(shouldDropSentryEvent(differentCode, hint())).toBe(false)
  })

  it('keeps unrelated application errors', () => {
    const event: Event = {
      exception: {
        values: [{ type: 'TypeError', value: 'Failed to load planner data' }],
      },
    }

    expect(shouldDropSentryEvent(event, hint(new TypeError('Failed to load planner data')))).toBe(false)
  })
})
