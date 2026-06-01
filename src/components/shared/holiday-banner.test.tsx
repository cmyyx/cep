// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent, cleanup } from '@testing-library/react'
import { HolidayBanner } from './holiday-banner'

const mockDismiss = vi.fn()
let mockActiveHoliday: {
  config: { id: string; i18nKey: string; icon: string; launchYear?: number }
  phase: 'countdown' | 'active'
  yearNumber?: number
} | null = null
let mockNow = new Date(2026, 0, 1, 12, 0, 0)
let mockYearText = ''

vi.mock('@/hooks/use-holiday', () => ({
  useHoliday: () => ({
    activeHoliday: mockActiveHoliday,
    dismiss: mockDismiss,
    now: mockNow,
    yearText: mockYearText,
    enabled: true,
    toggleEnabled: vi.fn(),
  }),
}))

const mockT = (key: string, params?: Record<string, unknown>) => {
  if (params?.yearText) return `${key}:${params.yearText}`
  return key
}
vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

describe('HolidayBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cleanup()
    mockDismiss.mockReset()
    mockActiveHoliday = null
    mockNow = new Date(2026, 0, 1, 12, 0, 0)
    mockYearText = ''
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders nothing when no activeHoliday', () => {
    const { container } = render(<HolidayBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders NormalContent with icon and banner text', () => {
    mockActiveHoliday = {
      config: { id: 'childrens-day', i18nKey: 'holiday.childrensDay', icon: 'star', launchYear: 2026 },
      phase: 'active',
      yearNumber: 1,
    }
    mockYearText = '1st'
    const { container } = render(<HolidayBanner />)
    const text = container.querySelector('span')
    expect(text?.textContent).toBe('holiday.childrensDay.banner:1st')
  })

  it('renders CountdownContent with timer', () => {
    mockNow = new Date(2025, 11, 31, 23, 30, 0)
    mockActiveHoliday = {
      config: { id: 'new-year', i18nKey: 'holiday.newYear', icon: 'party-popper' },
      phase: 'countdown',
    }
    const { container } = render(<HolidayBanner />)
    const spans = container.querySelectorAll('span')
    expect(spans[0]?.textContent).toBe('holiday.newYear.countdown')
    expect(spans[1]?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('dismiss button triggers exiting animation then calls dismiss', () => {
    mockActiveHoliday = {
      config: { id: 'childrens-day', i18nKey: 'holiday.childrensDay', icon: 'star' },
      phase: 'active',
    }
    const { container } = render(<HolidayBanner />)

    const btn = container.querySelector('button')
    expect(btn).not.toBeNull()
    fireEvent.click(btn!)
    expect(mockDismiss).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(200))
    expect(mockDismiss).toHaveBeenCalled()
  })

  it('resets exiting when holiday changes', () => {
    mockActiveHoliday = {
      config: { id: 'childrens-day', i18nKey: 'holiday.childrensDay', icon: 'star' },
      phase: 'active',
    }
    const { container, rerender } = render(<HolidayBanner />)
    expect(container.querySelector('[role="status"]')).not.toBeNull()

    mockActiveHoliday = {
      config: { id: 'new-year', i18nKey: 'holiday.newYear', icon: 'party-popper' },
      phase: 'active',
    }
    rerender(<HolidayBanner />)
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })
})
