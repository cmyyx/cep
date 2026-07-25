// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { VersionInfo } from '@/types/version'
import { GuardEnvironmentInfo } from './guard-environment-info'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const versionInfo: VersionInfo = {
  commit: 'abc123',
  count: 42,
  commitTime: '2026-07-25T10:30:00.000Z',
  buildTime: '2026-07-25T11:30:00.000Z',
  version: '0.1.0-abc123',
  forceUpgradeSerial: 1,
}

afterEach(cleanup)

it('renders browser, engine, and loaded site version details', () => {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  })

  render(<GuardEnvironmentInfo versionInfo={versionInfo} />)

  expect(screen.getByText('Chrome 126.0.0.0')).toBeTruthy()
  expect(screen.getByText('Chromium 126.0.0.0')).toBeTruthy()
  expect(screen.getByText('0.1.0-abc123')).toBeTruthy()
  expect(screen.getByText('42')).toBeTruthy()
})
