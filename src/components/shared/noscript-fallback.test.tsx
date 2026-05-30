// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { NoscriptFallback } from './noscript-fallback'

/**
 * In jsdom (JS-enabled), <noscript> innerHTML is always empty because
 * the browser hides its children. We use renderToString() to simulate
 * SSR output — this is exactly what appears in the static HTML served
 * to the browser, and is the only way to inspect <noscript> children.
 */

function ssrHtml() {
  return renderToString(<NoscriptFallback />)
}

describe('NoscriptFallback', () => {
  it('renders a <noscript> element in the DOM', () => {
    const { container } = render(<NoscriptFallback />)
    expect(container.querySelector('noscript')).not.toBeNull()
  })

  it('contains the app name in SSR output', () => {
    const html = ssrHtml()
    expect(html).toContain('CEP 终末地规划器')
  })

  it('contains the subtitle in SSR output', () => {
    expect(ssrHtml()).toContain('需要 JavaScript')
  })

  it('contains Chinese instruction text in SSR output', () => {
    const html = ssrHtml()
    expect(html).toContain('此应用需要 JavaScript 才能运行')
    expect(html).toContain('请在浏览器设置中启用 JavaScript 后刷新页面')
  })

  it('contains English instruction text in SSR output', () => {
    const html = ssrHtml()
    expect(html).toContain('This application requires JavaScript to run')
    expect(html).toContain(
      'Please enable JavaScript in your browser settings and refresh the page',
    )
  })

  it('renders the icon image with correct attributes in SSR output', () => {
    const html = ssrHtml()
    expect(html).toContain('src="/icon.svg"')
    expect(html).toContain('width="48"')
    expect(html).toContain('height="48"')
  })

  it('SSR output is wrapped in a single <noscript> tag', () => {
    const html = ssrHtml()
    // Should start with <noscript> and end with </noscript>
    expect(html).toMatch(/^<noscript>/)
    expect(html).toMatch(/<\/noscript>$/)
  })
})
