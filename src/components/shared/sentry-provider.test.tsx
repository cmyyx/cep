// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { VersionInfo } from '@/types/version'

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'browserTracing' })),
  replayIntegration: vi.fn(() => ({ name: 'replay' })),
}))

vi.mock('@sentry/react', () => sentryMocks)

import { SentryProvider } from './sentry-provider'

const version: VersionInfo = {
  commit: 'ea87444',
  count: 42,
  commitTime: '2026-07-29T00:00:00.000Z',
  buildTime: '2026-07-29T00:01:00.000Z',
  version: '1.2.0-ea87444',
  forceUpgradeSerial: 0,
}

afterEach(() => {
  vi.unstubAllEnvs()
})

it('initializes Sentry with the full application version release', async () => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1')

  render(<SentryProvider version={version}>content</SentryProvider>)

  await waitFor(() => expect(sentryMocks.init).toHaveBeenCalledTimes(1))
  expect(sentryMocks.init).toHaveBeenCalledWith(
    expect.objectContaining({
      release: '1.2.0-ea87444',
      beforeSend: expect.any(Function),
    }),
  )
})
