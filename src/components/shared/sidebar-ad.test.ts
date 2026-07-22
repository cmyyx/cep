// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { SidebarAd, shouldHideAdsForUser } from './sidebar-ad'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/features', () => ({
  FEATURES: { ads: true },
}))

vi.mock('@/lib/ad-telemetry', () => ({
  getAdOutcome: () => null,
  startAdAttempt: vi.fn(),
  subscribeAdOutcome: () => () => {},
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: {
      premiumUntil: string | null
      premiumPreGrantedUntil: string | null
    }) => unknown,
  ) => selector({ premiumUntil: null, premiumPreGrantedUntil: null }),
}))

afterEach(cleanup)

const NOW = Date.parse('2026-07-21T12:00:00+08:00')

it('shows ads for free users', () => {
  expect(shouldHideAdsForUser(null, null, NOW)).toBe(false)
})

it('hides ads for active paid premium', () => {
  expect(
    shouldHideAdsForUser('2026-08-01T00:00:00.000Z', null, NOW),
  ).toBe(true)
})

it('hides ads for active pre-granted premium', () => {
  expect(
    shouldHideAdsForUser(null, '2026-08-01T00:00:00.000Z', NOW),
  ).toBe(true)
})

it('shows ads when premium timestamps are expired', () => {
  expect(
    shouldHideAdsForUser('2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', NOW),
  ).toBe(false)
})

it.each(['NetworkError', 'SDKLoadError', 'Timeout', undefined])(
  'shows the failure and support copy for error code %s',
  (code) => {
    render(createElement(SidebarAd))

    fireEvent(
      window,
      new CustomEvent('cep:adwork-error', {
        detail: { code },
      }),
    )

    expect(screen.getByText('ads.loadFailed')).toBeTruthy()
    expect(screen.getByText('ads.supportMessage')).toBeTruthy()
  },
)
