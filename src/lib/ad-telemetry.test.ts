import { describe, expect, it } from 'vitest'
import {
  createAdEventPayload,
  type AdAttempt,
} from './ad-telemetry'

const ATTEMPT: AdAttempt = {
  attemptId: '018f2c8e-6bf0-7b5d-8f43-8d6c4d6dcbf1',
  path: '/zh-CN/essence-planner',
  locale: 'zh-CN',
  siteHost: 'end.canmoe.com',
  startedAt: '2026-07-21T00:00:00.000Z',
}

describe('ad telemetry payload', () => {
  it('keeps stable attempt dimensions and normalizes known errors', () => {
    const payload = createAdEventPayload(
      ATTEMPT,
      'error',
      '0.1.0-test',
      'Blank',
      new Date('2026-07-21T00:00:01.000Z'),
      '018f2c8e-6bf0-7b5d-8f43-8d6c4d6dcbf2',
    )
    expect(payload).toMatchObject({
      schemaVersion: 1,
      event: 'error',
      errorCode: 'Blank',
      placementId: 'sidebar-1110',
      path: ATTEMPT.path,
      locale: ATTEMPT.locale,
      buildVersion: '0.1.0-test',
    })
  })


  it('preserves unknown provider error codes for server-side diagnostics', () => {
    const payload = createAdEventPayload(
      ATTEMPT,
      'error',
      '0.1.0-test',
      'future-code',
      new Date('2026-07-21T00:00:01.000Z'),
      '018f2c8e-6bf0-7b5d-8f43-8d6c4d6dcbf3',
    )
    expect(payload.errorCode).toBe('future-code')
  })
})
