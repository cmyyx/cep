// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { resolveErrorI18nKey } from './error-i18n'

describe('resolveErrorI18nKey', () => {
  it('maps a known ApiError code to its namespaced key', () => {
    expect(resolveErrorI18nKey(new ApiError('invalid_credentials', 401), 'auth.loginFailed'))
      .toBe('auth.invalid_credentials')
  })

  it('falls back for an ApiError code with no mapping', () => {
    expect(resolveErrorI18nKey(new ApiError('brand_new_code', 500), 'auth.loginFailed'))
      .toBe('auth.loginFailed')
  })

  it('maps a plain Error whose message is a known code', () => {
    // useAuthStore rethrows the ApiError, but other layers throw Error(code).
    expect(resolveErrorI18nKey(new Error('turnstile_required'), 'auth.loginFailed'))
      .toBe('auth.turnstileRequired')
  })

  it('never returns a bare code for free-form messages', () => {
    expect(resolveErrorI18nKey(new Error('Failed to fetch'), 'auth.registerFailed'))
      .toBe('auth.registerFailed')
  })

  it('falls back for non-Error values and empty messages', () => {
    expect(resolveErrorI18nKey(undefined, 'auth.resetFailed')).toBe('auth.resetFailed')
    expect(resolveErrorI18nKey('invalid_credentials', 'auth.resetFailed')).toBe('auth.resetFailed')
    expect(resolveErrorI18nKey(new Error(''), 'auth.resetFailed')).toBe('auth.resetFailed')
  })

  it('always yields a namespaced key', () => {
    const cases: unknown[] = [
      new ApiError('unauthorized', 401),
      new ApiError('nope', 400),
      new Error('boom'),
      null,
    ]
    for (const err of cases) {
      expect(resolveErrorI18nKey(err, 'auth.loginFailed')).toContain('.')
    }
  })
})
