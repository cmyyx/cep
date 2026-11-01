// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))
vi.mock('@/hooks/use-ad-polling', () => ({ useAdPolling: () => {} }))

const mockIsMobile = vi.fn(() => true)
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mockIsMobile() }))

const mockHideAds = vi.fn(() => false)
vi.mock('@/hooks/use-should-hide-ads', () => ({ useShouldHideAds: () => mockHideAds() }))

import { AdworkSlot } from './adwork-slot'
import { resetAdworkStoreForTests, useAdworkStore } from '@/stores/useAdworkStore'
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
  resetAdworkStoreForTests()
  resetAdStoreForTests()
  resetAdSessionForTests()
  sendBeacon.mockReset()
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: sendBeacon,
    configurable: true,
    writable: true,
  })
  mockIsMobile.mockReturnValue(true)
  mockHideAds.mockReturnValue(false)
})

afterEach(cleanup)

function containerOf(rendered: HTMLElement): HTMLElement {
  const element = rendered.querySelector('.adwork-net')
  if (!(element instanceof HTMLElement)) throw new Error('adwork container is missing')
  return element
}

describe('AdworkSlot mounting', () => {
  it('mounts the mobile container with the placement attributes and a loading hint', () => {
    const { container } = render(<AdworkSlot variant="mobile" className="mt-3" />)
    const slot = containerOf(container)
    expect(slot.getAttribute('data-id')).toBe('1110')
    expect(slot.getAttribute('data-placeholder')).toBe('none')
    expect(slot.getAttribute('data-cep-adwork-slot')).toBe('mobile')
    // Vitest runs with NODE_ENV=test, so the container is in staging mode.
    expect(slot.getAttribute('data-mode')).toBe('staging')
    expect(screen.getByText('ad.loading')).toBeTruthy()
  })

  it('does not mount the desktop container on a mobile viewport', () => {
    mockIsMobile.mockReturnValue(true)
    const { container } = render(<AdworkSlot variant="desktop" />)
    expect(container.querySelector('.adwork-net')).toBeNull()
  })

  it('mounts exactly one variant: the desktop container at 300px on a wide viewport', () => {
    mockIsMobile.mockReturnValue(false)
    const { container } = render(<AdworkSlot variant="desktop" />)
    const slot = containerOf(container)
    expect(container.firstElementChild?.className).toContain('w-[300px]')
    expect(slot.className).toContain('adwork-auto')
    expect(container.querySelector('[data-cep-adwork-slot="mobile"]')).toBeNull()
  })

  it('renders nothing for a paid member', () => {
    mockHideAds.mockReturnValue(true)
    const { container } = render(<AdworkSlot variant="mobile" />)
    expect(container.firstElementChild).toBeNull()
  })
})

describe('AdworkSlot states', () => {
  it('shows the close button and drops the loading hint once filled', () => {
    render(<AdworkSlot variant="mobile" />)
    act(() => useAdworkStore.getState().setPhase('mobile', 'loaded'))
    expect(screen.queryByText('ad.loading')).toBeNull()
    expect(screen.getByRole('button', { name: 'ad.closeLabel' })).toBeTruthy()
  })

  it('falls back to the cloud ad after a failure', () => {
    useAdStore.setState({ currentAd: AD })
    const { container } = render(<AdworkSlot variant="mobile" />)
    act(() => useAdworkStore.getState().setPhase('mobile', 'failed'))
    const image = container.querySelector('img')
    expect(image?.getAttribute('src')).toBe(AD.mobileImageUrl)
    // The SDK container is hidden so a stale creative cannot reappear.
    expect(containerOf(container).className).toContain('hidden')
    expect(screen.getByRole('button', { name: 'ad.closeLabel' })).toBeTruthy()
  })

  it('explains the failure when there is no cloud creative to show', () => {
    const { container } = render(<AdworkSlot variant="mobile" />)
    act(() => useAdworkStore.getState().setPhase('mobile', 'failed'))
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('ad.loadFailed')).toBeTruthy()
    expect(screen.getByText('ad.supportMessage')).toBeTruthy()
  })

  it('keeps the container in the DOM after closing, but hides the slot', () => {
    const { container } = render(<AdworkSlot variant="mobile" className="mt-3" />)
    act(() => useAdworkStore.getState().setPhase('mobile', 'loaded'))
    fireEvent.click(screen.getByRole('button', { name: 'ad.closeLabel' }))

    const root = container.firstElementChild
    expect(root?.className).toContain('hidden')
    // The hidden container is what stops the SDK's route rescan from spinning
    // its 1ms interval looking for an element that no longer exists.
    expect(containerOf(container)).toBeTruthy()
    expect(useAdworkStore.getState().dismissed.mobile).toBe(true)
  })
})

describe('AdworkSlot click reporting', () => {
  it('reports a click on the creative anchor', () => {
    const { container } = render(<AdworkSlot variant="mobile" />)
    act(() => useAdworkStore.getState().setPhase('mobile', 'loaded'))
    const anchor = document.createElement('a')
    anchor.className = 'adwork-img'
    anchor.href = 'https://adwork.net/click?code=x'
    containerOf(container).appendChild(anchor)

    fireEvent.click(anchor)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const url = String(sendBeacon.mock.calls[0][0])
    expect(url).toContain('/api/v1/partners/adwork/1110/click?')
    expect(url).toContain('slot=mobile')
  })

  it('does not count the attribution badge or a synthetic close click', () => {
    const { container } = render(<AdworkSlot variant="mobile" />)
    act(() => useAdworkStore.getState().setPhase('mobile', 'loaded'))
    const badge = document.createElement('a')
    badge.className = 'ad-badge'
    const close = document.createElement('button')
    close.className = 'ad-close'
    containerOf(container).append(badge, close)

    fireEvent.click(badge)
    fireEvent.click(close)
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('intercepts the SDK close button before it can remove the container', () => {
    const { container } = render(<AdworkSlot variant="mobile" />)
    act(() => useAdworkStore.getState().setPhase('mobile', 'loaded'))
    const close = document.createElement('button')
    close.className = 'ad-close'
    containerOf(container).appendChild(close)

    fireEvent.click(close)
    // The container is still mounted: only our own state hides the slot.
    expect(container.querySelector('.adwork-net')).toBeTruthy()
    expect(useAdworkStore.getState().dismissed.mobile).toBe(true)
  })
})
