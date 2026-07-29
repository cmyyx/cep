import type { Event, EventHint } from '@sentry/react'

const TURNSTILE_ERROR_TYPE = 'TurnstileError'
const TURNSTILE_300010_MESSAGE = '[Cloudflare Turnstile] Error: 300010.'

interface ErrorLike {
  name?: unknown
  message?: unknown
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null
}

function isTurnstile300010(type: unknown, message: unknown): boolean {
  return type === TURNSTILE_ERROR_TYPE && message === TURNSTILE_300010_MESSAGE
}

export function shouldDropSentryEvent(event: Event, hint: EventHint): boolean {
  const matchesEvent = event.exception?.values?.some((exception) =>
    isTurnstile300010(exception.type, exception.value),
  )
  if (matchesEvent) return true

  const originalException = hint.originalException
  return (
    isErrorLike(originalException) &&
    isTurnstile300010(originalException.name, originalException.message)
  )
}
