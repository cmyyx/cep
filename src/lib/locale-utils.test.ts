import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectBrowserLocale,
  getExplicitLanguage,
  buildLocaleHref,
} from './locale-utils'

// Mock localStorage data
const mockLocalStorageData: Record<string, string> = {}

const mockLocalStorage = {
  getItem: (key: string) => mockLocalStorageData[key] ?? null,
  setItem: (key: string, value: string) => {
    mockLocalStorageData[key] = value
  },
  removeItem: (key: string) => {
    delete mockLocalStorageData[key]
  },
  clear: () => {
    for (const key in mockLocalStorageData) {
      delete mockLocalStorageData[key]
    }
  },
}

const mockLocation = {
  pathname: '/en/foo',
  origin: 'https://example.com',
  search: '?bar=1',
  hash: '#section',
}

const mockNavigator = { language: 'en-US' }

// Setup globals — stub individually so typeof checks resolve correctly
beforeEach(() => {
  vi.stubGlobal('window', { location: mockLocation, navigator: mockNavigator, localStorage: mockLocalStorage })
  vi.stubGlobal('navigator', mockNavigator)
  vi.stubGlobal('location', mockLocation)
  vi.stubGlobal('localStorage', mockLocalStorage)
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const key in mockLocalStorageData) {
    delete mockLocalStorageData[key]
  }
})

describe('detectBrowserLocale', () => {
  it('returns exact match for supported locale', () => {
    mockNavigator.language = 'ja'
    expect(detectBrowserLocale()).toBe('ja')
  })

  it('returns exact match case-insensitive', () => {
    mockNavigator.language = 'JA'
    expect(detectBrowserLocale()).toBe('ja')
  })

  it('maps zh-Hans to zh-CN', () => {
    mockNavigator.language = 'zh-Hans'
    expect(detectBrowserLocale()).toBe('zh-CN')
  })

  it('maps zh-hant to zh-TW (case-insensitive)', () => {
    mockNavigator.language = 'zh-hant'
    expect(detectBrowserLocale()).toBe('zh-TW')
  })

  it('maps zh-CN to zh-CN', () => {
    mockNavigator.language = 'zh-CN'
    expect(detectBrowserLocale()).toBe('zh-CN')
  })

  it('maps zh-TW to zh-TW', () => {
    mockNavigator.language = 'zh-TW'
    expect(detectBrowserLocale()).toBe('zh-TW')
  })

  it('maps zh-HK to zh-TW', () => {
    mockNavigator.language = 'zh-HK'
    expect(detectBrowserLocale()).toBe('zh-TW')
  })

  it('maps bare zh to zh-CN (default)', () => {
    mockNavigator.language = 'zh'
    expect(detectBrowserLocale()).toBe('zh-CN')
  })

  it('maps unknown zh variant to zh-CN (default)', () => {
    mockNavigator.language = 'zh-XX'
    expect(detectBrowserLocale()).toBe('zh-CN')
  })

  it('returns prefix match for non-Chinese locale', () => {
    mockNavigator.language = 'en-US'
    expect(detectBrowserLocale()).toBe('en')
  })

  it('returns prefix match for ja-JP', () => {
    mockNavigator.language = 'ja-JP'
    expect(detectBrowserLocale()).toBe('ja')
  })

  it('returns default for unknown locale', () => {
    mockNavigator.language = 'fr-FR'
    expect(detectBrowserLocale()).toBe('zh-CN')
  })

  it('returns default when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined)
    expect(detectBrowserLocale()).toBe('zh-CN')
  })
})

describe('getExplicitLanguage', () => {
  it('returns stored language when valid', () => {
    mockLocalStorageData['cep-settings'] = JSON.stringify({ language: 'ja' })
    expect(getExplicitLanguage()).toBe('ja')
  })

  it('returns null when language is auto', () => {
    mockLocalStorageData['cep-settings'] = JSON.stringify({ language: 'auto' })
    expect(getExplicitLanguage()).toBeNull()
  })

  it('returns null when cep-settings is missing', () => {
    expect(getExplicitLanguage()).toBeNull()
  })

  it('returns null when cep-settings is malformed JSON', () => {
    mockLocalStorageData['cep-settings'] = '{invalid json'
    expect(getExplicitLanguage()).toBeNull()
  })

  it('returns null when language field is missing', () => {
    mockLocalStorageData['cep-settings'] = JSON.stringify({ theme: 'dark' })
    expect(getExplicitLanguage()).toBeNull()
  })

  it('returns null when language is not a string', () => {
    mockLocalStorageData['cep-settings'] = JSON.stringify({ language: 123 })
    expect(getExplicitLanguage()).toBeNull()
  })

  it('returns null when language is unsupported', () => {
    mockLocalStorageData['cep-settings'] = JSON.stringify({ language: 'fr' })
    expect(getExplicitLanguage()).toBeNull()
  })

  it('returns null when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined)
    expect(getExplicitLanguage()).toBeNull()
  })
})

describe('buildLocaleHref', () => {
  beforeEach(() => {
    mockLocation.search = '?bar=1'
    mockLocation.hash = '#section'
  })

  it('replaces existing locale in path', () => {
    mockLocation.pathname = '/en/foo'
    expect(buildLocaleHref('zh-CN')).toBe(
      'https://example.com/zh-CN/foo?bar=1#section',
    )
  })

  it('replaces locale at root path with locale', () => {
    mockLocation.pathname = '/ja'
    expect(buildLocaleHref('en')).toBe(
      'https://example.com/en?bar=1#section',
    )
  })

  it('inserts locale when path is root', () => {
    mockLocation.pathname = '/'
    expect(buildLocaleHref('zh-CN')).toBe(
      'https://example.com/zh-CN/?bar=1#section',
    )
  })

  it('inserts locale when path has no locale prefix', () => {
    mockLocation.pathname = '/foo/bar'
    expect(buildLocaleHref('zh-CN')).toBe(
      'https://example.com/zh-CN/foo/bar?bar=1#section',
    )
  })

  it('preserves query and hash', () => {
    mockLocation.pathname = '/en/'
    mockLocation.search = '?key=value'
    mockLocation.hash = '#top'
    expect(buildLocaleHref('ja')).toBe(
      'https://example.com/ja/?key=value#top',
    )
  })

  it('handles empty search and hash', () => {
    mockLocation.pathname = '/en/'
    mockLocation.search = ''
    mockLocation.hash = ''
    expect(buildLocaleHref('zh-TW')).toBe(
      'https://example.com/zh-TW/',
    )
  })

  it('handles path with multiple segments', () => {
    mockLocation.pathname = '/en/essence/planner'
    expect(buildLocaleHref('ja')).toBe(
      'https://example.com/ja/essence/planner?bar=1#section',
    )
  })

  it('handles path without locale but with segments', () => {
    mockLocation.pathname = '/settings/profile'
    expect(buildLocaleHref('zh-CN')).toBe(
      'https://example.com/zh-CN/settings/profile?bar=1#section',
    )
  })
})
