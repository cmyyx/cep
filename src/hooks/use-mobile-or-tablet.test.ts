// @vitest-environment jsdom

import { expect, it } from 'vitest'
import { isMobileOrTabletDevice } from '@/hooks/use-mobile-or-tablet'

const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36'
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.3 Safari/605.1.15'

it.each([
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'],
  ['Android phone', 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 Chrome/134.0 Mobile Safari/537.36'],
  ['Android tablet', 'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Chrome/134.0 Safari/537.36'],
  ['Kindle tablet', 'Mozilla/5.0 (Linux; U; en-US) AppleWebKit/533.2 Kindle/3.0 Safari/533.2'],
])('allows a known %s user agent', (_label, userAgent) => {
  expect(isMobileOrTabletDevice({ userAgent })).toBe(true)
})

it('allows browsers that explicitly report a mobile form factor', () => {
  expect(isMobileOrTabletDevice({
    userAgent: WINDOWS_CHROME,
    userAgentDataMobile: true,
  })).toBe(true)
})

it('recognizes iPadOS when Safari requests the desktop site', () => {
  expect(isMobileOrTabletDevice({
    userAgent: MAC_SAFARI,
    platform: 'MacIntel',
    maxTouchPoints: 5,
  })).toBe(true)
})

it('uses touch-only capabilities as a fallback for masked tablet user agents', () => {
  expect(isMobileOrTabletDevice({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/134.0 Safari/537.36',
    maxTouchPoints: 10,
    coarsePointer: true,
    noHover: true,
  })).toBe(true)
})

it.each([
  ['Windows desktop', { userAgent: WINDOWS_CHROME, platform: 'Win32', maxTouchPoints: 0 }],
  ['macOS desktop', { userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 }],
  ['touch laptop with hover', { userAgent: WINDOWS_CHROME, platform: 'Win32', maxTouchPoints: 10, coarsePointer: true, noHover: false }],
])('blocks %s', (_label, signals) => {
  expect(isMobileOrTabletDevice(signals)).toBe(false)
})
