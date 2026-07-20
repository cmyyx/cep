import { expect, it } from 'vitest'
import { shouldHideAdsForUser } from './sidebar-ad'

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
