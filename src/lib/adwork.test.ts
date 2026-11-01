// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ADWORK_PLACEMENT_ID,
  adworkSlotFromElement,
  buildPartnerAdEventUrl,
  localeFromPath,
  resolveAdworkMode,
} from './adwork'
import { resetAdSessionForTests, shouldHideAdsForUser } from './ads'

beforeEach(() => {
  resetAdSessionForTests()
  window.sessionStorage.clear()
})

afterEach(() => {
  window.sessionStorage.clear()
})

describe('resolveAdworkMode', () => {
  it('honours an explicit mode', () => {
    expect(resolveAdworkMode('staging', 'production')).toBe('staging')
    expect(resolveAdworkMode('production', 'development')).toBe('production')
  })

  it('defaults to staging outside a production build', () => {
    expect(resolveAdworkMode(undefined, 'development')).toBe('staging')
    expect(resolveAdworkMode(undefined, 'test')).toBe('staging')
    expect(resolveAdworkMode(undefined, 'production')).toBe('production')
  })

  it('ignores an unknown value instead of shipping it to the SDK', () => {
    expect(resolveAdworkMode('prod', 'production')).toBe('production')
  })
})

describe('buildPartnerAdEventUrl', () => {
  it('sends impressions to the partner route with the session id', () => {
    const url = new URL(buildPartnerAdEventUrl('impression', 'mobile', '/zh-CN/planner', 'zh-CN'))
    expect(url.pathname).toBe(`/api/v1/partners/adwork/${ADWORK_PLACEMENT_ID}/impression`)
    expect(url.searchParams.get('slot')).toBe('mobile')
    expect(url.searchParams.get('path')).toBe('/zh-CN/planner')
    expect(url.searchParams.get('locale')).toBe('zh-CN')
    expect(url.searchParams.get('sid')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('keeps clicks bodyless and session free', () => {
    const url = new URL(buildPartnerAdEventUrl('click', 'desktop', '/', 'en'))
    expect(url.pathname).toBe(`/api/v1/partners/adwork/${ADWORK_PLACEMENT_ID}/click`)
    expect(url.searchParams.get('slot')).toBe('desktop')
    expect(url.searchParams.has('sid')).toBe(false)
  })
})

describe('localeFromPath', () => {
  it('reads the locale segment', () => {
    expect(localeFromPath('/zh-CN/planner')).toBe('zh-CN')
    expect(localeFromPath('/en')).toBe('en')
  })

  it('falls back to unknown instead of sending a path as the locale', () => {
    expect(localeFromPath('/')).toBe('unknown')
    expect(localeFromPath('/planner/zh-CN')).toBe('unknown')
  })
})

describe('adworkSlotFromElement', () => {
  it('reads the slot attribute', () => {
    const element = document.createElement('div')
    element.setAttribute('data-cep-adwork-slot', 'mobile')
    expect(adworkSlotFromElement(element)).toBe('mobile')
  })

  it('rejects an element the SDK reports without our marker', () => {
    expect(adworkSlotFromElement(document.createElement('div'))).toBeNull()
    expect(adworkSlotFromElement(null)).toBeNull()
  })
})

describe('shouldHideAdsForUser', () => {
  const now = Date.parse('2026-10-31T12:00:00.000Z')

  it('hides ads for an active subscription, pre-grant or trial', () => {
    for (const field of ['premiumUntil', 'premiumPreGrantedUntil', 'premiumTrialUntil'] as const) {
      const windows = {
        premiumUntil: null,
        premiumPreGrantedUntil: null,
        premiumTrialUntil: null,
        [field]: '2026-11-30T00:00:00.000Z',
      }
      expect(shouldHideAdsForUser(windows, now)).toBe(true)
    }
  })

  it('shows ads when every window expired or is malformed', () => {
    expect(
      shouldHideAdsForUser(
        {
          premiumUntil: '2026-01-01T00:00:00.000Z',
          premiumPreGrantedUntil: 'not-a-date',
          premiumTrialUntil: null,
        },
        now,
      ),
    ).toBe(false)
  })
})
