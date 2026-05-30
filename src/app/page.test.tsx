// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import RootRedirect from './page'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

vi.mock('@/lib/locale-utils', () => ({
  getExplicitLanguage: vi.fn(() => null),
  detectBrowserLocale: vi.fn(() => 'en'),
}))

vi.mock('@/components/shared/bootstrap-screen', () => ({
  BootstrapScreen: ({ timedOut, status }: { timedOut?: boolean; status?: string }) => (
    <div data-testid="bootstrap" data-timed-out={String(timedOut)} data-status={status} />
  ),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    pathname: '/',
    replace: vi.fn(),
  } as Location)
  mockReplace.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('RootRedirect', () => {
  it('calls router.replace with detected locale on mount', async () => {
    await act(async () => {
      render(<RootRedirect />)
    })
    expect(mockReplace).toHaveBeenCalledWith('/en')
  })

  it('falls back to location.replace after 10s timeout when router.replace is ineffective', async () => {
    const locationReplace = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      pathname: '/',
      replace: locationReplace,
    } as Location)

    await act(async () => {
      render(<RootRedirect />)
    })

    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    expect(locationReplace).toHaveBeenCalledWith('/en')
  })

  it('uses explicit language when available', async () => {
    const { getExplicitLanguage } = await import('@/lib/locale-utils')
    vi.mocked(getExplicitLanguage).mockReturnValue('ja')

    await act(async () => {
      render(<RootRedirect />)
    })

    expect(mockReplace).toHaveBeenCalledWith('/ja')
  })

  it('does not call location.replace if router.replace already redirected', async () => {
    const locationReplace = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      pathname: '/en',
      replace: locationReplace,
    } as Location)

    await act(async () => {
      render(<RootRedirect />)
    })

    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })

    expect(locationReplace).not.toHaveBeenCalled()
  })

  it('cleans up timers on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    let unmount: (() => void) | undefined
    await act(async () => {
      const result = render(<RootRedirect />)
      unmount = result.unmount
    })

    unmount!()
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
