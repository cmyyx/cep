// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { allowedDomains } = vi.hoisted(() => ({ allowedDomains: [] as string[] }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/features', () => ({
  FEATURES: { allowedDomains },
}))

vi.mock('@/hooks/use-blocked-page-guard', () => ({
  useBlockedPageGuard: vi.fn(),
}))

vi.mock('@/hooks/use-version', () => ({
  useVersion: () => ({
    info: null,
    localInfo: {
      commit: 'abc123',
      count: 42,
      commitTime: '2026-07-25T10:30:00.000Z',
      buildTime: '2026-07-25T11:30:00.000Z',
      version: '0.1.0-abc123',
      forceUpgradeSerial: 1,
    },
  }),
}))

vi.mock('next/image', () => ({
  default: ({ alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <span role="img" aria-label={alt} data-src={String(props.src)} />,
}))

import BlockedPage from './page'

beforeEach(() => {
  allowedDomains.splice(0)
})
afterEach(cleanup)

it('falls back to the default site hostname when no allowed domains are configured', () => {
  render(<BlockedPage />)

  const link = screen.getByRole('button', { name: /end\.canmoe\.com/ })
  expect(link.getAttribute('href')).toBe('https://end.canmoe.com')
  expect(link.getAttribute('data-blocked-allow')).toBe('true')
})

it('renders configured domain actions in their original order', () => {
  allowedDomains.push('first.example.com', 'second.example.com')
  render(<BlockedPage />)

  const actionLinks = screen.getAllByRole('button')
  expect(actionLinks.map((link) => link.getAttribute('href'))).toEqual([
    'https://first.example.com',
    'https://second.example.com',
  ])
})

it('renders the loaded site version in the shared environment details', () => {
  render(<BlockedPage />)

  expect(screen.getByText('0.1.0-abc123')).toBeTruthy()
})
