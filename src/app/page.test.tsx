// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import RootRedirectPage from './page'
import { ROOT_REDIRECT_SCRIPT } from '@/lib/root-redirect'

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

const here = path.dirname(fileURLToPath(import.meta.url))

// Rendered as static markup (not via @testing-library) because jsdom parses
// <noscript> children as text, which would hide the no-JS fallback from the DOM
// queries. Static markup is also what the export actually ships.
const html = renderToStaticMarkup(<RootRedirectPage />)
const source = readFileSync(path.join(here, 'page.tsx'), 'utf-8')

describe('root redirect page', () => {
  it('renders the inline locale redirect script verbatim', () => {
    expect(html).toContain(`<script id="root-redirect">${ROOT_REDIRECT_SCRIPT}</script>`)
  })

  it('renders the splash heading so the first frame is not blank', () => {
    expect(html).toContain('终末地规划器')
  })

  it('offers every locale as a manual link for no-JS users', () => {
    for (const [locale, label] of [
      ['zh-CN', '简体中文'],
      ['zh-TW', '繁體中文'],
      ['ja', '日本語'],
      ['en', 'English'],
    ] as const) {
      expect(html, locale).toContain(`href="/${locale}"`)
      expect(html, locale).toContain(label)
    }
  })

  it('falls back to a meta refresh when JavaScript is unavailable', () => {
    expect(html).toContain('http-equiv="refresh"')
    expect(html).toContain('content="0;url=/zh-CN"')
  })

  it('stays a server component (a "use client" directive would re-add the React bundle)', () => {
    expect(source).not.toMatch(/^\s*['"]use client['"]/m)
  })

  it('does not import the client-only BootstrapScreen', () => {
    expect(source).not.toContain('bootstrap-screen')
    expect(html).not.toContain('data-bootstrap-screen')
  })

  it('imports only server-renderable components', () => {
    const imports = [...source.matchAll(/from '(@\/[^']+)'/g)].map((m) => m[1])
    // Components that would drag React into the entry bundle.
    expect(imports).not.toContain('@/components/shared/bootstrap-screen')
    expect(imports).not.toContain('@/components/shared/app-init-overlay')
    expect(imports).not.toContain('@/components/ui/tooltip')
  })
})
