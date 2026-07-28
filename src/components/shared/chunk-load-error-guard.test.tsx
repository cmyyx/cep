// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import { ChunkLoadErrorGuard, __resetChunkLoadErrorForTests } from './chunk-load-error-guard'
import { useNavigationStore } from '@/stores/useNavigationStore'

vi.mock('@/hooks/use-version', () => ({
  useVersion: () => ({ localInfo: null, info: null }),
}))

const captureException = vi.fn()
vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

const messages = {
  chunkError: {
    title: 'Resource load failed',
    description: 'desc',
    resource: 'Resource',
    detail: 'Detail',
    retry: 'Retry',
    goHome: 'Go home',
  },
}

function renderGuard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChunkLoadErrorGuard />
    </NextIntlClientProvider>,
  )
}

// ChunkLoadErrorGuard reads sessionStorage and calls window.location.reload;
// mock both before each test.
const reloadSpy = vi.fn()
const locationAssignSpy = vi.fn()

beforeEach(() => {
  cleanup()
  vi.resetAllMocks()
  __resetChunkLoadErrorForTests()
  useNavigationStore.getState().resetNavigation()
  sessionStorage.clear()
  reloadSpy.mockReset()
  locationAssignSpy.mockReset()
  captureException.mockReset()
  // window.location is non-configurable in jsdom; replace via Object.defineProperty.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      reload: reloadSpy,
      assign: locationAssignSpy,
    },
  })
})

afterEach(() => {
  cleanup()
})

// Keep a pre-rejected promise that is consumed (.catch) so vitest does not
// flag it as unhandled. We attach it to PromiseRejectionEvent below.
const consumedRejection = Promise.reject(new Error('native import failed'))
consumedRejection.catch(() => { /* swallow */ })

it('auto-reloads once on the first ChunkLoadError (clears stale HTML references)', () => {
  renderGuard()
  expect(reloadSpy).not.toHaveBeenCalled()
  // Simulate an in-flight navigation so the overlay would be spinning.
  act(() => {
    useNavigationStore.getState().startNavigation('Target page')
  })
  expect(useNavigationStore.getState().isNavigating || useNavigationStore.getState().isProgressing).toBe(true)

  act(() => {
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: Object.assign(new Error('Loading chunk 42 failed.\n(error: https://cep.app/_next/static/chunks/x.js)'), { name: 'ChunkLoadError' }),
      }),
    )
  })

  expect(reloadSpy).toHaveBeenCalledTimes(1)
  // Reported to Sentry with the failing resource URL.
  expect(captureException).toHaveBeenCalledTimes(1)
  const [, context] = captureException.mock.calls[0]
  expect(context).toMatchObject({ tags: { chunk_load_error: true }, extra: { resource: expect.stringContaining('chunks/x.js'), auto_reload: true } })
  // The navigation UI must be reset so the overlay stops spinning during
  // the unload → reload gap.
  const navState = useNavigationStore.getState()
  expect(navState.isNavigating).toBe(false)
  expect(navState.isProgressing).toBe(false)
  // No error page rendered yet — the page is reloading.
  expect(screen.queryByRole('heading', { name: 'Resource load failed' })).toBeNull()
})

it('shows the full-screen error page (with failing resource URL) on the second failure instead of looping', () => {
  sessionStorage.setItem('cep-chunk-reload-once', '1')
  renderGuard()

  act(() => {
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: Object.assign(
          new Error('Loading chunk 99 failed.\n(error: https://cep.app/_next/static/chunks/missing.js)'),
          { name: 'ChunkLoadError' },
        ),
      }),
    )
  })

  expect(reloadSpy).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Resource load failed' })).toBeTruthy()
  // The failing resource URL is surfaced (host stripped).
  expect(screen.getByText('/_next/static/chunks/missing.js')).toBeTruthy()
  // Reported with auto_reload=false since we're past the first reload.
  expect(captureException).toHaveBeenCalledTimes(1)
  expect(captureException.mock.calls[0][1]).toMatchObject({ extra: { auto_reload: false } })
})

it('ignores unrelated errors', () => {
  renderGuard()

  act(() => {
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new Error('some unrelated runtime error'),
      }),
    )
  })

  expect(reloadSpy).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('cep-chunk-reload-once')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Resource load failed' })).toBeNull()
  // Unrelated errors are NOT reported.
  expect(captureException).not.toHaveBeenCalled()
})

it('also catches unhandledrejection from a failed dynamic import()', () => {
  sessionStorage.setItem('cep-chunk-reload-once', '1')
  renderGuard()

  act(() => {
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: consumedRejection,
        reason: new Error('Failed to fetch dynamically imported module: https://cep.app/_next/static/chunks/y.js'),
      }),
    )
  })

  expect(screen.getByRole('heading', { name: 'Resource load failed' })).toBeTruthy()
  expect(screen.getByText('/_next/static/chunks/y.js')).toBeTruthy()
})

it('retry button clears the reload guard and reloads', () => {
  sessionStorage.setItem('cep-chunk-reload-once', '1')
  renderGuard()

  act(() => {
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: Object.assign(new Error('Loading chunk 1 failed.'), { name: 'ChunkLoadError' }),
      }),
    )
  })

  act(() => {
    screen.getByRole('button', { name: 'Retry' }).click()
  })

  expect(sessionStorage.getItem('cep-chunk-reload-once')).toBeNull()
  expect(reloadSpy).toHaveBeenCalledTimes(1)
})
