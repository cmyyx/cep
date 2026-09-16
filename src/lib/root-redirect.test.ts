// @vitest-environment jsdom

import vm from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROOT_REDIRECT_SCRIPT } from '@/lib/root-redirect'
import { detectBrowserLocale } from '@/lib/locale-utils'

/**
 * The root redirect is now an inline script, so its locale resolution is a
 * second implementation of `detectBrowserLocale()`. If the two ever disagree,
 * a user whose browser says "ja" would be sent to a different locale than the
 * in-app language switcher reports — so this test executes the emitted script
 * in a vm sandbox and asserts it matches the TypeScript function for every
 * input shape the function handles.
 */

type RunOptions = {
  language?: string
  stored?: unknown
  storedRaw?: string | null
  pathname?: string
  search?: string
  hash?: string
  breakLocalStorage?: boolean
}

function runScript(options: RunOptions = {}): string | undefined {
  const replaced: string[] = []
  const { language = 'en-US', stored, storedRaw, pathname = '/', search = '', hash = '' } = options

  const sandbox = {
    navigator: { language },
    localStorage: {
      getItem(key: string) {
        if (key !== 'cep-settings') return null
        if (options.breakLocalStorage) throw new Error('storage disabled')
        if (storedRaw !== undefined) return storedRaw
        if (stored === undefined) return null
        return JSON.stringify({ language: stored })
      },
    },
    location: {
      origin: 'https://end.canmoe.com',
      pathname,
      search,
      hash,
      replace(url: string) { replaced.push(url) },
    },
  }

  vm.runInNewContext(ROOT_REDIRECT_SCRIPT, sandbox)
  return replaced[0]
}

const target = (options: RunOptions = {}) => runScript(options)?.replace('https://end.canmoe.com', '')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('root redirect script', () => {
  it('never contains </script> (it is inlined via dangerouslySetInnerHTML)', () => {
    expect(ROOT_REDIRECT_SCRIPT).not.toContain('</script>')
  })

  describe('browser detection matches detectBrowserLocale()', () => {
    const LANGUAGES = [
      'zh-CN', 'zh-cn', 'ZH-CN',
      'zh-Hans', 'zh-Hans-CN', 'zh-Hant', 'zh-Hant-TW',
      'zh-TW', 'zh-HK', 'zh-MO', 'zh', 'zh-XX', 'zhx',
      'ja', 'ja-JP', 'JA-jp',
      'en', 'en-US', 'en-GB',
      'fr', 'fr-FR', 'ko', 'de-DE', 'ru-RU',
      '', 'x',
    ]

    it.each(LANGUAGES)('language "%s"', (language) => {
      const spy = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language)
      expect(target({ language })).toBe(`/${detectBrowserLocale()}`)
      spy.mockRestore()
    })
  })

  describe('case handling is pinned to expected values, not just "both agree"', () => {
    // The matrix above only proves the script and detectBrowserLocale() agree.
    // These assert the actual destinations, so a change that made both
    // implementations wrong in the same way would still fail here.
    it.each([
      ['JA-jp', '/ja'],
      ['JA', '/ja'],
      ['EN-us', '/en'],
      ['ZH-CN', '/zh-CN'],
      ['ZH-Hant', '/zh-TW'],
      ['ZH-HK', '/zh-TW'],
      ['FR-fr', '/zh-CN'],
      ['zhx', '/zh-CN'],
    ])('language "%s" → %s', (language, expected) => {
      expect(target({ language })).toBe(expected)
    })
  })

  describe('explicit stored preference wins', () => {
    it('uses the stored locale over the browser locale', () => {
      expect(target({ language: 'en-US', stored: 'ja' })).toBe('/ja')
    })

    it('ignores "auto" and falls back to detection', () => {
      expect(target({ language: 'ja', stored: 'auto' })).toBe('/ja')
    })

    it('ignores unsupported stored locales', () => {
      expect(target({ language: 'en-US', stored: 'fr' })).toBe('/en')
    })

    it('ignores a non-string stored locale', () => {
      expect(target({ language: 'en-US', stored: 42 })).toBe('/en')
    })

    it('ignores a corrupt settings blob and still redirects', () => {
      expect(target({ language: 'ja', storedRaw: '{not json' })).toBe('/ja')
    })

    it('ignores a settings blob without a language key', () => {
      expect(target({ language: 'ja', storedRaw: JSON.stringify({ theme: 'dark' }) })).toBe('/ja')
    })
  })

  describe('robustness', () => {
    it('still redirects when localStorage throws (private mode / blocked storage)', () => {
      expect(target({ language: 'ja', breakLocalStorage: true })).toBe('/ja')
    })

    it('preserves the query string and hash', () => {
      expect(target({ language: 'ja', search: '?utm_source=x', hash: '#top' }))
        .toBe('/ja?utm_source=x#top')
    })

    it('always produces an absolute redirect (location.replace, not a relative push)', () => {
      expect(runScript({ language: 'ja' })).toBe('https://end.canmoe.com/ja')
    })
  })
})
