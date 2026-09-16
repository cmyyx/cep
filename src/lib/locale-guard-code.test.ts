import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { LOCALE_GUARD_HEAD_CODE } from '@/lib/locale-guard-code'

/**
 * The locale guard moved out of the React <head> tree and into the postbuild
 * guard bundle, so its behaviour is no longer covered by rendering the old
 * component. These tests execute the emitted code directly — it now runs
 * synchronously before every stylesheet and chunk request, where a mistake
 * means either a redirect loop or a page stuck in the wrong language.
 */

type Options = {
  pathname?: string
  stored?: unknown
  storedRaw?: string | null
  origin?: string
  search?: string
  hash?: string
}

function run(options: Options = {}) {
  const { pathname = '/zh-CN', origin = 'https://end.canmoe.com', search = '', hash = '' } = options
  const replaced: string[] = []
  const lang = { value: '' }

  const sandbox = {
    window: {
      location: {
        pathname,
        origin,
        search,
        hash,
        replace(url: string) { replaced.push(url) },
      },
    },
    document: {
      documentElement: {
        get lang() { return lang.value },
        set lang(value: string) { lang.value = value },
      },
    },
    localStorage: {
      getItem(key: string) {
        if (key !== 'cep-settings') return null
        if (options.storedRaw !== undefined) return options.storedRaw
        if (options.stored === undefined) return null
        return JSON.stringify({ language: options.stored })
      },
    },
  }

  vm.runInNewContext(LOCALE_GUARD_HEAD_CODE, sandbox)
  return { redirected: replaced[0], lang: lang.value }
}

describe('LOCALE_GUARD_HEAD_CODE', () => {
  it('never contains </script> (it is inlined into the guard bundle)', () => {
    expect(LOCALE_GUARD_HEAD_CODE).not.toContain('</script>')
  })

  it('stays ES5-compatible so old browsers can still run it', () => {
    expect(LOCALE_GUARD_HEAD_CODE).not.toMatch(/\bconst\b|\blet\b|=>/)
  })

  describe('document language', () => {
    it('sets <html lang> from the URL locale before the redirect check', () => {
      const { lang } = run({ pathname: '/ja/wiki' })
      expect(lang).toBe('ja')
    })

    it('matches the locale case-insensitively', () => {
      expect(run({ pathname: '/ZH-TW' }).lang).toBe('zh-TW')
    })

    it('leaves lang untouched for non-locale paths', () => {
      expect(run({ pathname: '/unknown' }).lang).toBe('')
    })
  })

  describe('redirect on explicit-language mismatch', () => {
    it('redirects when the stored language differs from the URL locale', () => {
      expect(run({ pathname: '/zh-CN', stored: 'ja' }).redirected)
        .toBe('https://end.canmoe.com/ja')
    })

    it('preserves the remaining path, query and hash', () => {
      expect(run({ pathname: '/zh-CN/wiki/weapons', stored: 'en', search: '?a=1', hash: '#top' }).redirected)
        .toBe('https://end.canmoe.com/en/wiki/weapons?a=1#top')
    })

    it('inserts the locale when the first segment is not a locale', () => {
      expect(run({ pathname: '/foo/bar', stored: 'ja' }).redirected)
        .toBe('https://end.canmoe.com/ja/foo/bar')
    })

    it('does nothing when the stored language already matches the URL', () => {
      expect(run({ pathname: '/ja', stored: 'ja' }).redirected).toBeUndefined()
    })

    it('matches the URL locale case-insensitively when comparing', () => {
      expect(run({ pathname: '/JA', stored: 'ja' }).redirected).toBeUndefined()
    })
  })

  describe('no redirect without an explicit preference', () => {
    it('does nothing when nothing is stored', () => {
      expect(run({ pathname: '/zh-CN' }).redirected).toBeUndefined()
    })

    it('does nothing when the preference is "auto"', () => {
      expect(run({ pathname: '/zh-CN', stored: 'auto' }).redirected).toBeUndefined()
    })

    it('does nothing when the stored language is unsupported', () => {
      expect(run({ pathname: '/zh-CN', stored: 'fr' }).redirected).toBeUndefined()
    })

    it('does nothing when the path has no locale segment', () => {
      expect(run({ pathname: '/', stored: 'ja' }).redirected).toBeUndefined()
    })
  })

  describe('robustness', () => {
    it('never throws on a corrupt settings blob', () => {
      expect(() => run({ pathname: '/zh-CN', storedRaw: '{not json' })).not.toThrow()
      expect(run({ pathname: '/zh-CN', storedRaw: '{not json' }).redirected).toBeUndefined()
    })

    it('never throws when localStorage access is blocked', () => {
      const sandbox = {
        window: { location: { pathname: '/zh-CN', origin: 'https://x', search: '', hash: '', replace() {} } },
        document: { documentElement: { lang: '' } },
        localStorage: { getItem() { throw new Error('blocked') } },
      }
      expect(() => vm.runInNewContext(LOCALE_GUARD_HEAD_CODE, sandbox)).not.toThrow()
    })
  })
})
