// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LanguageSwitcher } from './language-switcher'

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
vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: (
    selector: (s: { language: string; setLanguage: (l: string) => void }) => unknown,
  ) => selector({ language: 'auto', setLanguage: mockSetLanguage }),
}))

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile: false }),
  SidebarMenuButton: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
}))

// Base UI dropdown primitives are pointer-event driven and do not open in
// jsdom; replace them with pass-through elements so the option list and
// click handlers can be exercised directly.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <div />,
}))

let origWindow: typeof globalThis.window
const mockLocation = { ...window.location, href: '' }

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    origWindow = globalThis.window
    mockLocation.href = ''
    vi.stubGlobal('window', { ...window, location: mockLocation })
    mockUseLocale.mockReturnValue('zh-CN')
    mockDetectBrowserLocale.mockReturnValue('en')
    mockBuildLocaleHref.mockImplementation((locale: string) => `https://example.com/${locale}/`)
    mockSetLanguage.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    globalThis.window = origWindow
  })

  it('shows the native label of the current URL locale', () => {
    render(<LanguageSwitcher />)
    // Trigger label + the zh-CN menu option
    expect(screen.getAllByText('简体中文').length).toBeGreaterThanOrEqual(1)
  })

  it('lists the AUTO option and all four locales in native script', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByText('English AUTO')).toBeDefined()
    expect(screen.getAllByText('简体中文').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('繁體中文')).toBeDefined()
    expect(screen.getByText('日本語')).toBeDefined()
    expect(screen.getByText('English')).toBeDefined()
  })

  it('clicking a locale persists it and jumps to the locale URL', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByText('日本語'))
    expect(mockSetLanguage).toHaveBeenCalledWith('ja')
    expect(mockBuildLocaleHref).toHaveBeenCalledWith('ja')
    expect(mockLocation.href).toBe('https://example.com/ja/')
  })

  it('clicking AUTO stores auto and jumps to the detected locale', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByText('English AUTO'))
    expect(mockSetLanguage).toHaveBeenCalledWith('auto')
    expect(mockLocation.href).toBe('https://example.com/en/')
  })

  it('clicking the current locale does not navigate', () => {
    render(<LanguageSwitcher />)
    const options = screen.getAllByText('简体中文')
    fireEvent.click(options[options.length - 1])
    expect(mockSetLanguage).toHaveBeenCalledWith('zh-CN')
    expect(mockLocation.href).toBe('')
  })
})
