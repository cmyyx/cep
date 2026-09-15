// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))
vi.mock('@/hooks/use-ad-polling', () => ({ useAdPolling: () => {} }))

import { AdSlot } from './ad-slot'
import { resetAdStoreForTests, useAdStore } from '@/stores/useAdStore'
import { resetAdSessionForTests } from '@/lib/ads'
import type { AdItem } from '@/types/ad'

const AD: AdItem = {
  id: 7,
  title: 'campaign',
  desktopImageUrl: 'https://end-ops.canmoe.com/media/creatives/7/desktop',
  mobileImageUrl: 'https://end-ops.canmoe.com/media/creatives/7/mobile',
  targetUrl: 'https://example.com/campaign',
}

const sendBeacon = vi.fn()
beforeEach(() => {
  resetAdStoreForTests()
  resetAdSessionForTests()
  sendBeacon.mockReset()
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: sendBeacon,
    configurable: true,
    writable: true,
  })
})

afterEach(cleanup)

it('renders nothing when no ad is active (no placeholder)', () => {
  const { container } = render(<AdSlot variant="desktop" />)
  expect(container.childElementCount).toBe(0)
})

it('renders the desktop image with fluid 280:380 sizing and a direct target link', () => {
  useAdStore.setState({ currentAd: AD })
  const { container } = render(<AdSlot variant="desktop" />)
  const link = screen.getByRole('link')
  expect(link.getAttribute('href')).toBe(AD.targetUrl)
  expect(link.getAttribute('target')).toBe('_blank')
  const img = container.querySelector('img')
  expect(img?.getAttribute('src')).toBe(AD.desktopImageUrl)
  expect(img?.getAttribute('alt')).toBe('campaign')
  expect(link.className).toContain('aspect-[280/380]')
  expect(link.className).toContain('h-full')
  expect(link.className).toContain('w-auto')
})

it('reports the click via sendBeacon without blocking the link', () => {
  useAdStore.setState({ currentAd: AD })
  render(<AdSlot variant="desktop" />)
  fireEvent.click(screen.getByRole('link'))
  expect(sendBeacon).toHaveBeenCalledTimes(1)
  expect(sendBeacon.mock.calls[0][0]).toContain('/api/v1/creatives/7/click?')
  expect(sendBeacon.mock.calls[0][0]).toContain(encodeURIComponent(window.location.pathname))
  expect(sendBeacon.mock.calls[0][0]).toContain('locale=zh-CN')
})

it('renders the mobile image sized 320x100 and falls back to the alt key when title is empty', () => {
  useAdStore.setState({ currentAd: { ...AD, title: '', targetUrl: null } })
  const { container } = render(<AdSlot variant="mobile" />)
  expect(screen.queryByRole('link')).toBeNull()
  const img = container.querySelector('img')
  expect(img?.getAttribute('src')).toBe(AD.mobileImageUrl)
  expect(img?.getAttribute('alt')).toBe('ad.imageAlt')
  expect(img?.parentElement?.className).toContain('w-[320px]')
  expect(img?.parentElement?.className).toContain('h-[100px]')
})

it('renders nothing on the variant whose creative is missing', () => {
  useAdStore.setState({ currentAd: { ...AD, mobileImageUrl: null } })
  const mobile = render(<AdSlot variant="mobile" />)
  expect(mobile.container.childElementCount).toBe(0)
  cleanup()
  const desktop = render(<AdSlot variant="desktop" />)
  expect(desktop.container.querySelector('img')?.getAttribute('src')).toBe(AD.desktopImageUrl)
})

it('reports one impression per mount once the creative loads', () => {
  useAdStore.setState({ currentAd: AD })
  const { container } = render(<AdSlot variant="desktop" />)
  const img = container.querySelector('img')
  expect(img).not.toBeNull()
  // 未加载完成不上报
  expect(sendBeacon).not.toHaveBeenCalled()
  fireEvent.load(img!)
  expect(sendBeacon).toHaveBeenCalledTimes(1)
  expect(sendBeacon.mock.calls[0][0]).toContain('/api/v1/creatives/7/impression?')
  expect(sendBeacon.mock.calls[0][0]).toContain('slot=desktop')
  // 同一挂载周期内的重复 load 不会重复上报
  fireEvent.load(img!)
  expect(sendBeacon).toHaveBeenCalledTimes(1)
})

it('reports the impression for the mobile slot when that creative loads', () => {
  useAdStore.setState({ currentAd: { ...AD, targetUrl: null } })
  const { container } = render(<AdSlot variant="mobile" />)
  fireEvent.load(container.querySelector('img')!)
  expect(sendBeacon).toHaveBeenCalledTimes(1)
  expect(sendBeacon.mock.calls[0][0]).toContain('/api/v1/creatives/7/impression?')
  expect(sendBeacon.mock.calls[0][0]).toContain('slot=mobile')
})
