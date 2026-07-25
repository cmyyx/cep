import { describe, expect, it } from 'vitest'
import { buildBrowserInfoInlineCode, parseBrowserInfo } from './browser-info'

describe('parseBrowserInfo', () => {
  it.each([
    {
      label: 'Chrome',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      browser: 'Chrome 126.0.0.0',
      engine: 'Chromium 126.0.0.0',
    },
    {
      label: 'Edge',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87',
      browser: 'Edge 126.0.2592.87',
      engine: 'Chromium 126.0.0.0',
    },
    {
      label: 'Firefox',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      browser: 'Firefox 128.0',
      engine: 'Gecko 128.0',
    },
    {
      label: 'Safari',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      browser: 'Safari 17.5',
      engine: 'WebKit 605.1.15',
    },
    {
      label: 'Chrome on iOS',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
      browser: 'Chrome 126.0.6478.54',
      engine: 'WebKit 605.1.15',
    },
  ])('detects $label', ({ ua, browser, engine }) => {
    expect(parseBrowserInfo(ua)).toEqual({ browser, engine })
  })

  it('returns explicit fallbacks for an unknown user agent', () => {
    expect(parseBrowserInfo('custom-client')).toEqual({
      browser: 'Unknown',
      engine: 'Unknown',
    })
  })
})

it('generates early-guard code from the same browser rules', () => {
  const code = buildBrowserInfoInlineCode('ua')

  expect(code).toContain('Samsung Internet')
  expect(code).toContain('Chromium')
  expect(code).toContain(')(ua)')
})
