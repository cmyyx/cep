// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
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

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={String(href)} {...props}>{children}</a>,
}))

import NotFoundPage from './page'

afterEach(cleanup)

it('renders the localized 404 action and shared environment details', () => {
  render(<NotFoundPage />)

  expect(screen.getByRole('heading', { name: '404' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'notFound.homeLink' }).getAttribute('href')).toBe('/en')
  expect(screen.getByText('0.1.0-abc123')).toBeTruthy()
})
