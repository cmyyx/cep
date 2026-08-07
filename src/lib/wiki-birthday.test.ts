import { describe, expect, it } from 'vitest'
import { formatBirthday } from './wiki-birthday'

describe('formatBirthday', () => {
  it('formats zh-CN as 4月10日', () => {
    expect(formatBirthday({ month: 4, day: 10 }, 'zh-CN')).toBe('4月10日')
  })

  it('formats zh-TW as 4月10日', () => {
    expect(formatBirthday({ month: 4, day: 10 }, 'zh-TW')).toBe('4月10日')
  })

  it('formats ja as 4月10日', () => {
    expect(formatBirthday({ month: 4, day: 10 }, 'ja')).toBe('4月10日')
  })

  it('formats en as "April 10"', () => {
    expect(formatBirthday({ month: 4, day: 10 }, 'en')).toBe('April 10')
  })

  it('formats single-digit day with no zero padding', () => {
    expect(formatBirthday({ month: 1, day: 3 }, 'en')).toBe('January 3')
    expect(formatBirthday({ month: 1, day: 3 }, 'zh-CN')).toBe('1月3日')
  })
})
