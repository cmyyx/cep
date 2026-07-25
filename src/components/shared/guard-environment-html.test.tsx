// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { versionData } from '@/generated/version-data'
import { formatTime } from '@/lib/utils'
import { BrowserGuard } from './browser-guard'
import { CssGuard } from './css-guard'
import { GUARD_ENVIRONMENT_HTML_CODE } from './guard-layout'

afterEach(cleanup)

it('builds escaped browser and site version details for early guards', () => {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87',
  })

  // Evaluate the same compile-time expression that BrowserGuard/CssGuard embed.
  // Source is build-owned; not user input.
  const html = new Function(`"use strict"; return (${GUARD_ENVIRONMENT_HTML_CODE});`)() as string

  expect(html).toContain('Edge 126.0.2592.87')
  expect(html).toContain('Chromium 126.0.0.0')
  expect(html).toContain(versionData.version)
  expect(html).toContain(String(versionData.count))
  expect(html).toContain(formatTime(versionData.commitTime))
  expect(html).toContain(formatTime(versionData.buildTime))
  expect(html).toContain('浏览器 / Browser')
  expect(html).toContain('内核 / Engine')
  expect(html).toContain('版本 / Version')
  expect(html).toContain('提交次数 / Commits')
  expect(html).toContain('提交时间 / Commit Time')
  expect(html).toContain('构建时间 / Build Time')
})

it('embeds the shared environment builder into browser and css guard scripts', () => {
  const browser = render(<BrowserGuard />)
  const browserCode = browser.container.querySelector('#browser-guard')?.innerHTML ?? ''
  expect(browserCode).toContain(versionData.version)
  expect(browserCode).toContain('navigator.userAgent')
  expect(browserCode).toContain('\\u7248\\u672C / Version')
  browser.unmount()

  const css = render(<CssGuard />)
  const cssCode = css.container.querySelector('#css-guard')?.innerHTML ?? ''
  expect(cssCode).toContain(versionData.version)
  expect(cssCode).toContain('navigator.userAgent')
  expect(cssCode).toContain('\\u7248\\u672C / Version')
})
