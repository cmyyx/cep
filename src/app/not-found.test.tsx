// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotFound from './not-found'

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/generated/version-data', () => ({
  versionData: {
    commit: 'abc123',
    count: 42,
    commitTime: '2026-07-25T10:30:00.000Z',
    buildTime: '2026-07-25T11:30:00.000Z',
    version: '0.1.0-abc123',
    forceUpgradeSerial: 1,
  },
}))

vi.mock('@/lib/locale-utils', () => ({
  getExplicitLanguage: () => 'zh-CN',
  detectBrowserLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <span role="img" aria-label={alt} data-src={String(props.src)} />
  ),
}))

let replaceSpy: ReturnType<typeof vi.fn>
let currentPath = '/'

beforeEach(() => {
  currentPath = '/'
  replaceSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get pathname() {
        return currentPath
      },
      get search() {
        return ''
      },
      get hash() {
        return ''
      },
      replace: replaceSpy,
    },
  })
})

afterEach(() => {
  cleanup()
})

describe('NotFound (single static root 404)', () => {
  it('ships every locale panel with matching copy and home link', () => {
    render(<NotFound />)

    expect(screen.getAllByRole('heading', { name: '404' }).length).toBe(4)
    expect(document.querySelectorAll('.bg-engineering-grid').length).toBe(4)
    expect(document.querySelectorAll('[data-src="/icon.png"]').length).toBe(4)

    const expected = [
      ['zh-CN', '页面未找到', '返回首页', '/zh-CN'],
      ['zh-TW', '頁面未找到', '返回首頁', '/zh-TW'],
      ['ja', 'ページが見つかりません', 'ホームに戻る', '/ja'],
      ['en', 'Page Not Found', 'Return Home', '/en'],
    ] as const

    expect(screen.getAllByRole('button').map((link) => link.textContent)).toEqual(
      expected.map(([, , homeLink]) => homeLink),
    )
    for (const [locale, title, , href] of expected) {
      const panel = document.querySelector(`[data-notfound-panel="${locale}"]`)
      expect(panel?.textContent).toContain(title)
      expect(panel?.querySelector('a')?.getAttribute('href')).toBe(href)
    }
  })

  it('renders the version metadata panel without VersionProvider', () => {
    render(<NotFound />)
    expect(screen.getAllByText('0.1.0-abc123').length).toBe(4)
  })

  it('does not redirect for locale-prefixed paths', () => {
    currentPath = '/en/anything'
    render(<NotFound />)
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('redirects to the preferred language for paths without a locale prefix', () => {
    currentPath = '/123'
    render(<NotFound />)
    expect(replaceSpy).toHaveBeenCalledWith('/zh-CN/123')
  })
})
