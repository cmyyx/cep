// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent, cleanup, screen } from '@testing-library/react'
import { BirthdayBanner } from './birthday-banner'

const mockDismiss = vi.fn()
let mockCharacterIds: string[] = []
let mockLocale = 'zh-CN'

vi.mock('@/hooks/use-birthday', () => ({
  useBirthday: () => ({
    characterIds: mockCharacterIds,
    dismiss: mockDismiss,
    now: new Date(2026, 3, 10, 12, 0, 0),
  }),
}))

const mockT = (key: string) => {
  if (key === 'birthday.prefix') return '今天是'
  if (key === 'birthday.nameSeparator') return mockLocale === 'en' ? ', ' : '、'
  if (key === 'birthday.suffix') return '的生日哦～'
  if (key === 'common.close') return '关闭'
  if (key === 'characters.chr_0009_azrila') return '余烬'
  if (key === 'characters.chr_0023_antal') return '安塔尔'
  if (key === 'characters.chr_0004_pelica') return '佩丽卡'
  return key
}

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
  useLocale: () => mockLocale,
}))

vi.mock('@/components/shared/nav-link', () => ({
  NavLink: ({ children, href, className }: React.ComponentProps<'a'> & { loadingLabel?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe('BirthdayBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cleanup()
    mockDismiss.mockReset()
    mockCharacterIds = []
    mockLocale = 'zh-CN'
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders nothing when nobody has a birthday today', () => {
    const { container } = render(<BirthdayBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a merged banner for same-day operators', () => {
    mockCharacterIds = ['chr_0009_azrila', 'chr_0023_antal']
    render(<BirthdayBanner />)
    expect(screen.getByText('今天是')).toBeTruthy()
    expect(screen.getByText('的生日哦～')).toBeTruthy()
    expect(screen.getByText('、')).toBeTruthy()
  })

  it('links each operator name to its wiki page', () => {
    mockCharacterIds = ['chr_0009_azrila', 'chr_0023_antal']
    render(<BirthdayBanner />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/zh-CN/wiki/characters/chr_0009_azrila',
      '/zh-CN/wiki/characters/chr_0023_antal',
    ])
    expect(links.map((link) => link.textContent)).toEqual(['余烬', '安塔尔'])
  })

  it('uses locale-aware separators', () => {
    mockCharacterIds = ['chr_0009_azrila', 'chr_0023_antal']
    mockLocale = 'en'
    const { container } = render(<BirthdayBanner />)
    expect(container.textContent).toContain(', ')
  })

  it('dismisses once per exit animation and ignores repeated clicks', () => {
    mockCharacterIds = ['chr_0009_azrila']
    render(<BirthdayBanner />)
    const closeButton = screen.getByRole('button')

    fireEvent.click(closeButton)
    fireEvent.click(closeButton)
    expect(mockDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(mockDismiss).toHaveBeenCalledTimes(1)

    // The timer ref is cleared after completion, so a later dismissal can schedule again.
    fireEvent.click(closeButton)
    act(() => vi.advanceTimersByTime(200))
    expect(mockDismiss).toHaveBeenCalledTimes(2)
  })

  it('cancels a pending dismissal when unmounted during the exit delay', () => {
    mockCharacterIds = ['chr_0009_azrila']
    const { unmount } = render(<BirthdayBanner />)
    fireEvent.click(screen.getByRole('button'))
    unmount()

    act(() => vi.advanceTimersByTime(200))
    expect(mockDismiss).not.toHaveBeenCalled()
  })
})
