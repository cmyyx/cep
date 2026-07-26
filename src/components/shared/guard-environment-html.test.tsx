import { expect, it } from 'vitest'
import { parseBrowserInfo } from '@/lib/browser-info'
import { BROWSER_GUARD_CODE } from './browser-guard'
import { CSS_GUARD_CODE } from './css-guard'
import {
  GUARD_ENVIRONMENT_HTML_CODE,
  GUARD_ENVIRONMENT_LABELS,
  GUARD_ENVIRONMENT_VALUES,
} from './guard-layout'

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
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain('document.documentElement.lang')
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain("replace(/[&<>\"']/g")
  // Path segment is preferred only when it matches a label key; otherwise lang, then en.
  expect(GUARD_ENVIRONMENT_HTML_CODE).toMatch(/for\(var k in L\)/)
  expect(GUARD_ENVIRONMENT_HTML_CODE).toMatch(/if\(!q\)\{for\(var k2 in L\)/)
  expect(GUARD_ENVIRONMENT_HTML_CODE).toContain("if(!q)q='en'")
})

it('embeds the shared environment builder into browser and css guard scripts', () => {
  // BrowserGuard 已外置为 /guards.js (src/app/guards.js/route.ts), 直接校验代码字符串。
  expect(BROWSER_GUARD_CODE).toContain(GUARD_ENVIRONMENT_VALUES.version)
  expect(BROWSER_GUARD_CODE).toContain('navigator.userAgent')
  expect(BROWSER_GUARD_CODE).toContain(GUARD_ENVIRONMENT_LABELS.en.version)
  expect(BROWSER_GUARD_CODE).toContain(GUARD_ENVIRONMENT_LABELS.ja.version)

  // CSS_GUARD_CODE 经 /guard-inline.js 由 postbuild 注入 html <head>。
  expect(CSS_GUARD_CODE).toContain(GUARD_ENVIRONMENT_VALUES.version)
  expect(CSS_GUARD_CODE).toContain('navigator.userAgent')
  expect(CSS_GUARD_CODE).toContain(GUARD_ENVIRONMENT_LABELS['zh-CN'].version)
  expect(CSS_GUARD_CODE).toContain(GUARD_ENVIRONMENT_LABELS['zh-TW'].version)
})
