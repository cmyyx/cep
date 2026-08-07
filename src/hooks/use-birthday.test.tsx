// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBirthday } from './use-birthday'
import { useHolidayStore } from '@/stores/useHolidayStore'

vi.mock('@/generated/data/wiki/character-birthdays', () => ({
  characterBirthdays: [
    { id: 'chr_0009_azrila', month: 4, day: 10 },
    { id: 'chr_0023_antal', month: 4, day: 10 },
    { id: 'chr_0004_pelica', month: 3, day: 16 },
  ],
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 3, 10, 12, 0, 0))
  useHolidayStore.setState({
    dismissedHolidays: {},
    holidayEffectsEnabled: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useBirthday', () => {
  it('returns today\'s birthday operator ids', () => {
    const { result } = renderHook(() => useBirthday())
    expect(result.current.characterIds).toEqual(['chr_0009_azrila', 'chr_0023_antal'])
  })

  it('returns empty ids when nobody has a birthday today', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
    const { result } = renderHook(() => useBirthday())
    expect(result.current.characterIds).toEqual([])
  })

  it('hides the banner for the rest of the year after dismiss', () => {
    const { result } = renderHook(() => useBirthday())
    act(() => result.current.dismiss())
    expect(useHolidayStore.getState().dismissedHolidays['birthday-4-10']).toBe(2026)
    expect(result.current.characterIds).toEqual([])
  })

  it('shows the banner again in the next year (per-year dismissal)', () => {
    const { result } = renderHook(() => useBirthday())
    act(() => result.current.dismiss())
    expect(result.current.characterIds).toEqual([])

    // Next year, same date: the dismissal is year-scoped so the banner returns.
    vi.setSystemTime(new Date(2027, 3, 10, 12, 0, 0))
    const { result: nextYear } = renderHook(() => useBirthday())
    expect(nextYear.current.characterIds).toEqual(['chr_0009_azrila', 'chr_0023_antal'])
  })

  it('respects the shared holiday effects toggle', () => {
    useHolidayStore.setState({ holidayEffectsEnabled: false })
    const { result } = renderHook(() => useBirthday())
    expect(result.current.characterIds).toEqual([])
  })

  it('stays hidden after dismiss even when the toggle is re-enabled', () => {
    const { result } = renderHook(() => useBirthday())
    act(() => result.current.dismiss())
    useHolidayStore.setState({ holidayEffectsEnabled: true })
    expect(result.current.characterIds).toEqual([])
  })
})
