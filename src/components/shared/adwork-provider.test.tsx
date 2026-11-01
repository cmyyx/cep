// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/script', () => ({
  default: () => <div data-testid="adwork-script" />,
}))

const mockHideAds = vi.fn(() => false)
vi.mock('@/hooks/use-should-hide-ads', () => ({ useShouldHideAds: () => mockHideAds() }))

import { AdworkProvider } from './adwork-provider'
import { resetAdworkStoreForTests, useAdworkStore } from '@/stores/useAdworkStore'
import { resetAdSessionForTests } from '@/lib/ads'

const sendBeacon = vi.fn()

beforeEach(() => {
  resetAdworkStoreForTests()
  resetAdSessionForTests()
  sendBeacon.mockReset()
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: sendBeacon,
    configurable: true,
    writable: true,
  })
  mockHideAds.mockReturnValue(false)
})

afterEach(cleanup)

describe('AdworkProvider', () => {
  it('loads the SDK once the client is ready', () => {
    render(<AdworkProvider />)
    expect(screen.getByTestId('adwork-script')).toBeTruthy()
  })

  it('does not load the SDK for a paid member', () => {
    mockHideAds.mockReturnValue(true)
    render(<AdworkProvider />)
    expect(screen.queryByTestId('adwork-script')).toBeNull()
  })
})

describe('the global media callbacks', () => {
  it('marks the reported slot loaded and sends one impression', () => {
    const element = document.createElement('div')
    element.setAttribute('data-cep-adwork-slot', 'mobile')
    useAdworkStore.getState().activate('mobile')

    act(() => window.adwork?.onLoaded({ element }))

    expect(useAdworkStore.getState().phases.mobile).toBe('loaded')
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(String(sendBeacon.mock.calls[0][0])).toContain('/api/v1/partners/adwork/1110/impression?')
  })

  it('ignores an element the SDK reports without our slot marker', () => {
    useAdworkStore.getState().activate('mobile')
    act(() => window.adwork?.onLoaded({ element: document.createElement('div') }))
    expect(useAdworkStore.getState().phases.mobile).toBe('idle')
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('marks the active slot failed on a request error', () => {
    useAdworkStore.getState().activate('desktop')
    act(() => window.adwork?.onError({ code: 'Blank', message: 'No ad returned' }))
    expect(useAdworkStore.getState().phases.desktop).toBe('failed')
  })
})
