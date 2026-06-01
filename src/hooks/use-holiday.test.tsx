// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHoliday } from './use-holiday'

const mockDismissHoliday = vi.fn()
const mockToggleHolidayEffects = vi.fn()

let storeState = {
  dismissedHolidays: {} as Record<string, number>,
  holidayEffectsEnabled: true,
  dismissHoliday: mockDismissHoliday,
  toggleHolidayEffects: mockToggleHolidayEffects,
}

vi.mock('@/stores/useHolidayStore', () => ({
  useHolidayStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}))

let mockLocale = 'en'
vi.mock('next-intl', () => ({
  useLocale: () => mockLocale,
}))

vi.mock('@/lib/holidays', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/holidays')>()
  return {
    ...mod,
    getActiveHoliday: vi.fn((date: Date) => {
      const month = date.getMonth() + 1
      const day = date.getDate()
      if (month === 1 && day === 1) {
        return { config: { id: 'new-year', i18nKey: 'holiday.newYear', icon: 'party-popper' }, phase: 'active' }
      }
      if (month === 6 && day === 1) {
        return {
          config: { id: 'childrens-day', i18nKey: 'holiday.childrensDay', icon: 'star', launchYear: 2026 },
          phase: 'active',
          yearNumber: 1,
        }
      }
      return null
    }),
  }
})

describe('useHoliday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storeState = {
      dismissedHolidays: {},
      holidayEffectsEnabled: true,
      dismissHoliday: mockDismissHoliday,
      toggleHolidayEffects: mockToggleHolidayEffects,
    }
    mockLocale = 'en'
    mockDismissHoliday.mockReset()
    mockToggleHolidayEffects.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns activeHoliday when enabled and not dismissed', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0))
    const { result } = renderHook(() => useHoliday())
    expect(result.current.activeHoliday).not.toBeNull()
    expect(result.current.activeHoliday!.config.id).toBe('new-year')
  })

  it('returns null activeHoliday when disabled', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0))
    storeState.holidayEffectsEnabled = false
    const { result } = renderHook(() => useHoliday())
    expect(result.current.activeHoliday).toBeNull()
  })

  it('returns null activeHoliday when holiday is dismissed', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0))
    storeState.dismissedHolidays = { 'new-year': 2026 }
    const { result } = renderHook(() => useHoliday())
    expect(result.current.activeHoliday).toBeNull()
  })

  it('calls dismissHoliday with correct args on dismiss', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0))
    const { result } = renderHook(() => useHoliday())
    act(() => result.current.dismiss())
    expect(mockDismissHoliday).toHaveBeenCalledWith('new-year', 2026)
  })

  it('formats yearText with English ordinal for en locale', () => {
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0)) // childrens-day
    mockLocale = 'en'
    const { result } = renderHook(() => useHoliday())
    expect(result.current.yearText).toBe('1st')
  })

  it('formats yearText with Chinese number for zh locale', () => {
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0))
    mockLocale = 'zh-CN'
    const { result } = renderHook(() => useHoliday())
    expect(result.current.yearText).toBe('一')
  })

  it('formats yearText with Chinese number for ja locale', () => {
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0))
    mockLocale = 'ja'
    const { result } = renderHook(() => useHoliday())
    expect(result.current.yearText).toBe('一')
  })

  it('returns empty yearText when no yearNumber', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0)) // new-year has no launchYear
    const { result } = renderHook(() => useHoliday())
    expect(result.current.yearText).toBe('')
  })

  it('exposes enabled and toggleEnabled from store', () => {
    const { result } = renderHook(() => useHoliday())
    expect(result.current.enabled).toBe(true)
    act(() => result.current.toggleEnabled())
    expect(mockToggleHolidayEffects).toHaveBeenCalled()
  })
})
