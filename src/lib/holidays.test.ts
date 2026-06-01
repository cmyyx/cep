import { describe, it, expect } from 'vitest'
import {
  getEnglishOrdinal,
  getChineseYearNumber,
  getYearNumber,
  getActiveHoliday,
  HOLIDAYS,
} from './holidays'

describe('getEnglishOrdinal', () => {
  it('returns "st" for 1', () => {
    expect(getEnglishOrdinal(1)).toBe('1st')
  })

  it('returns "nd" for 2', () => {
    expect(getEnglishOrdinal(2)).toBe('2nd')
  })

  it('returns "rd" for 3', () => {
    expect(getEnglishOrdinal(3)).toBe('3rd')
  })

  it('returns "th" for 4-20', () => {
    expect(getEnglishOrdinal(4)).toBe('4th')
    expect(getEnglishOrdinal(10)).toBe('10th')
    expect(getEnglishOrdinal(11)).toBe('11th')
    expect(getEnglishOrdinal(12)).toBe('12th')
    expect(getEnglishOrdinal(13)).toBe('13th')
    expect(getEnglishOrdinal(20)).toBe('20th')
  })

  it('returns correct suffix for 21-30', () => {
    expect(getEnglishOrdinal(21)).toBe('21st')
    expect(getEnglishOrdinal(22)).toBe('22nd')
    expect(getEnglishOrdinal(23)).toBe('23rd')
    expect(getEnglishOrdinal(24)).toBe('24th')
    expect(getEnglishOrdinal(30)).toBe('30th')
  })
})

describe('getChineseYearNumber', () => {
  it('returns Chinese numeral for 1-30', () => {
    expect(getChineseYearNumber(1)).toBe('一')
    expect(getChineseYearNumber(10)).toBe('十')
    expect(getChineseYearNumber(11)).toBe('十一')
    expect(getChineseYearNumber(20)).toBe('二十')
    expect(getChineseYearNumber(21)).toBe('二十一')
    expect(getChineseYearNumber(30)).toBe('三十')
  })

  it('falls back to string for out-of-range values', () => {
    expect(getChineseYearNumber(0)).toBe('0')
    expect(getChineseYearNumber(31)).toBe('31')
    expect(getChineseYearNumber(100)).toBe('100')
  })
})

describe('getYearNumber', () => {
  it('calculates year number from launch year', () => {
    expect(getYearNumber(2026, 2026)).toBe(1)
    expect(getYearNumber(2026, 2027)).toBe(2)
    expect(getYearNumber(2020, 2025)).toBe(6)
  })
})

describe('getActiveHoliday', () => {
  it('returns null when no holiday matches', () => {
    const date = new Date(2026, 5, 15) // June 15
    expect(getActiveHoliday(date)).toBeNull()
  })

  it('returns new-year countdown on Dec 31 at 23:00', () => {
    const date = new Date(2025, 11, 31, 23, 0)
    const result = getActiveHoliday(date)
    expect(result).not.toBeNull()
    expect(result!.config.id).toBe('new-year')
    expect(result!.phase).toBe('countdown')
  })

  it('returns new-year active on Jan 1', () => {
    const date = new Date(2026, 0, 1, 12, 0)
    const result = getActiveHoliday(date)
    expect(result).not.toBeNull()
    expect(result!.config.id).toBe('new-year')
    expect(result!.phase).toBe('active')
  })

  it('returns null for Dec 31 before 23:00', () => {
    const date = new Date(2025, 11, 31, 22, 59)
    expect(getActiveHoliday(date)).toBeNull()
  })

  it('returns childrens-day on June 1', () => {
    const date = new Date(2026, 5, 1, 10, 0)
    const result = getActiveHoliday(date)
    expect(result).not.toBeNull()
    expect(result!.config.id).toBe('childrens-day')
    expect(result!.phase).toBe('active')
  })

  it('returns game-anniversary with yearNumber on Jan 22', () => {
    const date = new Date(2027, 0, 22, 10, 0)
    const result = getActiveHoliday(date)
    expect(result).not.toBeNull()
    expect(result!.config.id).toBe('game-anniversary')
    expect(result!.phase).toBe('active')
    expect(result!.yearNumber).toBe(2) // 2027 - 2026 + 1
  })

  it('returns tool-anniversary with yearNumber on Jan 29', () => {
    const date = new Date(2026, 0, 29, 10, 0)
    const result = getActiveHoliday(date)
    expect(result).not.toBeNull()
    expect(result!.config.id).toBe('tool-anniversary')
    expect(result!.phase).toBe('active')
    expect(result!.yearNumber).toBe(1) // 2026 - 2026 + 1
  })

  it('returns undefined yearNumber for holidays without launchYear', () => {
    const date = new Date(2026, 0, 1, 12, 0) // new-year
    const result = getActiveHoliday(date)
    expect(result).not.toBeNull()
    expect(result!.yearNumber).toBeUndefined()
  })

  it('HOLIDAYS contains expected configs', () => {
    const ids = HOLIDAYS.map((h) => h.id)
    expect(ids).toContain('new-year')
    expect(ids).toContain('game-anniversary')
    expect(ids).toContain('tool-anniversary')
    expect(ids).toContain('childrens-day')
  })
})
