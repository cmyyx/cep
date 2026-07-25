// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { parseBrowserInfo } from '@/lib/browser-info'
import { BrowserGuard } from './browser-guard'
import { CssGuard } from './css-guard'
import {
  GUARD_ENVIRONMENT_HTML_CODE,
  GUARD_ENVIRONMENT_LABELS,
  GUARD_ENVIRONMENT_VALUES,
} from './guard-layout'

afterEach(cleanup)

it('inlines escaped browser and localized site version details for early guards', () => {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87'
  const browserInfo = parseBrowserInfo(userAgent)

  expect(browserInfo.browser).toBe('Edge 126.0.2592.87')
  expect(browserInfo.engine).toBe('Chromium 126.0.0.0')
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain(JSON.stringify(GUARD_ENVIRONMENT_VALUES))
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain(JSON.stringify(GUARD_ENVIRONMENT_LABELS))
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain('<dl style="display:flex')
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain("window.location.pathname")
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain("replace(/[&<>\"']/g")
})

it('embeds the shared environment builder into browser and css guard scripts', () => {
  const browser = render(<BrowserGuard />)
  const browserCode = browser.container.querySelector('#browser-guard')?.innerHTML ?? ''
  expect(browserCode).toContain(GUARD_ENVIRONMENT_VALUES.version)
  expect(browserCode).toContain('navigator.userAgent')
  expect(browserCode).toContain(GUARD_ENVIRONMENT_LABELS.en.version)
  expect(browserCode).toContain(GUARD_ENVIRONMENT_LABELS.ja.version)
  browser.unmount()

  const css = render(<CssGuard />)
  const cssCode = css.container.querySelector('#css-guard')?.innerHTML ?? ''
  expect(cssCode).toContain(GUARD_ENVIRONMENT_VALUES.version)
  expect(cssCode).toContain('navigator.userAgent')
  expect(cssCode).toContain(GUARD_ENVIRONMENT_LABELS['zh-CN'].version)
  expect(cssCode).toContain(GUARD_ENVIRONMENT_LABELS['zh-TW'].version)
})
