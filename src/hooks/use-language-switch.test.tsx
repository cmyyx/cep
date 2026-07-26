// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_NATIVE_LABELS,
  getLanguageNativeLabel,
  useLanguageSwitch,
} from './use-language-switch'

const mockUseLocale = vi.fn()
vi.mock('next-intl', () => ({
  useLocale: () => mockUseLocale(),
}))

const mockDetectBrowserLocale = vi.fn()
const mockBuildLocaleHref = vi.fn()
vi.mock('@/lib/locale-utils', () => ({
  detectBrowserLocale: () => mockDetectBrowserLocale(),
  buildLocaleHref: (locale: string) => mockBuildLocaleHref(locale),
}))

const mockSetLanguage = vi.fn()
let storeLanguage = 'auto'
vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: (
    selector: (s: { language: string; setLanguage: (l: string) => void }) => unknown,
  ) => selector({ language: storeLanguage, setLanguage: mockSetLanguage }),
}))

let origWindow: typeof globalThis.window
const mockLocation = { ...window.location, href: '' }

describe('useLanguageSwitch', () => {
  beforeEach(() => {
    origWindow = globalThis.window
    mockLocation.href = ''
    vi.stubGlobal('window', { ...window, location: mockLocation })
    mockUseLocale.mockReturnValue('zh-CN')
    mockDetectBrowserLocale.mockReturnValue('en')
    mockBuildLocaleHref.mockImplementation((locale: string) => `https://example.com/${locale}/`)
    mockSetLanguage.mockReset()
    storeLanguage = 'auto'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.window = origWindow
  })

  it('returns urlLocale and stored language', () => {
    storeLanguage = 'ja'
    const { result } = renderHook(() => useLanguageSwitch())
    expect(result.current.urlLocale).toBe('zh-CN')
    expect(result.current.language).toBe('ja')
  })

  it('persists and jumps when switching to a different locale', () => {
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.switchLanguage('ja'))
    expect(mockSetLanguage).toHaveBeenCalledWith('ja')
    expect(mockBuildLocaleHref).toHaveBeenCalledWith('ja')
    expect(mockLocation.href).toBe('https://example.com/ja/')
  })

  it('persists without jumping when target matches urlLocale', () => {
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.switchLanguage('zh-CN'))
    expect(mockSetLanguage).toHaveBeenCalledWith('zh-CN')
    expect(mockLocation.href).toBe('')
  })

  it('auto: stores auto and jumps to the detected locale', () => {
    mockDetectBrowserLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.switchLanguage('auto'))
    expect(mockSetLanguage).toHaveBeenCalledWith('auto')
    expect(mockLocation.href).toBe('https://example.com/en/')
  })

  it('auto: does not jump when detected locale matches urlLocale', () => {
    mockDetectBrowserLocale.mockReturnValue('zh-CN')
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.switchLanguage('auto'))
    expect(mockSetLanguage).toHaveBeenCalledWith('auto')
    expect(mockLocation.href).toBe('')
  })

  it('ignores null and unsupported values', () => {
    const { result } = renderHook(() => useLanguageSwitch())
    act(() => result.current.switchLanguage(null))
    act(() => result.current.switchLanguage('fr'))
    expect(mockSetLanguage).not.toHaveBeenCalled()
    expect(mockLocation.href).toBe('')
  })
})

describe('language label table', () => {
  it('covers every language option with a native label', () => {
    for (const loc of LANGUAGE_OPTIONS) {
      expect(LANGUAGE_NATIVE_LABELS[loc]).toBeTruthy()
    }
    expect(Object.keys(LANGUAGE_NATIVE_LABELS)).toHaveLength(LANGUAGE_OPTIONS.length)
  })

  it('getLanguageNativeLabel falls back to the input for unknown locales', () => {
    expect(getLanguageNativeLabel('ja')).toBe('日本語')
    expect(getLanguageNativeLabel('fr')).toBe('fr')
  })
})
