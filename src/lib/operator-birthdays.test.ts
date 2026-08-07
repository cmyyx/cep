import { describe, expect, it } from 'vitest'
import {
  getBirthdayCharacterIds,
  getBirthdayDismissKey,
  getBirthdayNameSeparator,
  joinBirthdayNames,
} from './operator-birthdays'

const birthdays = [
  { id: 'chr_0009_azrila', month: 4, day: 10 },
  { id: 'chr_0023_antal', month: 4, day: 10 },
  { id: 'chr_0004_pelica', month: 3, day: 16 },
] as const

describe('getBirthdayCharacterIds', () => {
  it('returns all characters born on the given date (same-day merge)', () => {
    expect(getBirthdayCharacterIds(new Date(2026, 3, 10), birthdays)).toEqual([
      'chr_0009_azrila',
      'chr_0023_antal',
    ])
  })

  it('returns an empty list when nobody has a birthday that day', () => {
    expect(getBirthdayCharacterIds(new Date(2026, 0, 1), birthdays)).toEqual([])
  })

  it('ignores the year — birthdays recur annually', () => {
    expect(getBirthdayCharacterIds(new Date(2031, 2, 16), birthdays)).toEqual(['chr_0004_pelica'])
  })
})

describe('getBirthdayDismissKey', () => {
  it('builds a stable month-day key shared with the holiday store', () => {
    expect(getBirthdayDismissKey(new Date(2026, 3, 10))).toBe('birthday-4-10')
    expect(getBirthdayDismissKey(new Date(2026, 11, 19))).toBe('birthday-12-19')
  })
})

describe('getBirthdayNameSeparator', () => {
  it('uses 、 for zh/ja and ", " for en', () => {
    expect(getBirthdayNameSeparator('zh-CN')).toBe('、')
    expect(getBirthdayNameSeparator('zh-TW')).toBe('、')
    expect(getBirthdayNameSeparator('ja')).toBe('、')
    expect(getBirthdayNameSeparator('en')).toBe(', ')
  })
})

describe('joinBirthdayNames', () => {
  it('joins names with the locale separator', () => {
    expect(joinBirthdayNames(['安塔尔', '余烬'], 'zh-CN')).toBe('安塔尔、余烬')
    expect(joinBirthdayNames(['Antal', 'Ember'], 'en')).toBe('Antal, Ember')
  })
})
