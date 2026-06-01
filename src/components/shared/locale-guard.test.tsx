// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { LocaleGuard } from './locale-guard'

// Mock next-intl
const mockUseLocale = vi.fn()
vi.mock('next-intl', () => ({
  useLocale: () => mockUseLocale(),
}))

// Mock locale-utils
const mockGetExplicitLanguage = vi.fn()
const mockBuildLocaleHref = vi.fn()
vi.mock('@/lib/locale-utils', () => ({
  getExplicitLanguage: () => mockGetExplicitLanguage(),
  buildLocaleHref: (locale: string) => mockBuildLocaleHref(locale),
}))

// Save originals
let origWindow: typeof globalThis.window
let origLocation: typeof globalThis.location

// Mock location with replace
const mockReplace = vi.fn()
const mockLocation = {
  ...window.location,
  replace: mockReplace,
}

describe('LocaleGuard', () => {
  beforeEach(() => {
    origWindow = globalThis.window
    origLocation = globalThis.location
    vi.stubGlobal('window', { ...window, location: mockLocation })
    vi.stubGlobal('location', mockLocation)
    mockUseLocale.mockReturnValue('zh-CN')
    mockGetExplicitLanguage.mockReturnValue(null)
    mockBuildLocaleHref.mockImplementation((locale: string) => `https://example.com/${locale}/`)
    mockReplace.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.window = origWindow
    globalThis.location = origLocation
  })

  it('sets document.documentElement.lang to urlLocale', () => {
    mockUseLocale.mockReturnValue('ja')
    render(<LocaleGuard />)
    expect(document.documentElement.lang).toBe('ja')
  })

  it('updates document.documentElement.lang when urlLocale changes', () => {
    mockUseLocale.mockReturnValue('zh-CN')
    const { rerender } = render(<LocaleGuard />)
    expect(document.documentElement.lang).toBe('zh-CN')

    mockUseLocale.mockReturnValue('en')
    rerender(<LocaleGuard />)
    expect(document.documentElement.lang).toBe('en')
  })

  it('redirects when explicit language differs from urlLocale', () => {
    mockUseLocale.mockReturnValue('zh-CN')
    mockGetExplicitLanguage.mockReturnValue('ja')
    mockBuildLocaleHref.mockReturnValue('https://example.com/ja/')
    render(<LocaleGuard />)
    expect(mockReplace).toHaveBeenCalledWith('https://example.com/ja/')
  })

  it('does not redirect when explicit language matches urlLocale', () => {
    mockUseLocale.mockReturnValue('ja')
    mockGetExplicitLanguage.mockReturnValue('ja')
    render(<LocaleGuard />)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect when explicit language is null (AUTO)', () => {
    mockUseLocale.mockReturnValue('zh-CN')
    mockGetExplicitLanguage.mockReturnValue(null)
    render(<LocaleGuard />)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
