// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { GREETING_KEYS, PLACEHOLDER_GREETING, getGreetingKey } from './greeting-section'

describe('getGreetingKey', () => {
  it('covers every hour of the day with a known bucket', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(GREETING_KEYS).toContain(getGreetingKey(hour))
    }
  })

  it('treats 09:00-10:59 as morning instead of evening', () => {
    // Regression: the previous buckets were 0-5 / 5-9 / 11-13 / 13-18, so 9 and
    // 10 fell through to the evening fallback.
    expect(getGreetingKey(9)).toBe('home.greetingMorning')
    expect(getGreetingKey(10)).toBe('home.greetingMorning')
  })

  it('maps each bucket boundary to the expected greeting', () => {
    expect(getGreetingKey(0)).toBe('home.greetingNight')
    expect(getGreetingKey(4)).toBe('home.greetingNight')
    expect(getGreetingKey(5)).toBe('home.greetingMorning')
    expect(getGreetingKey(11)).toBe('home.greetingNoon')
    expect(getGreetingKey(12)).toBe('home.greetingNoon')
    expect(getGreetingKey(13)).toBe('home.greetingAfternoon')
    expect(getGreetingKey(17)).toBe('home.greetingAfternoon')
    expect(getGreetingKey(18)).toBe('home.greetingEvening')
    expect(getGreetingKey(23)).toBe('home.greetingEvening')
  })

  it('uses morning as the stable hydration placeholder', () => {
    expect(PLACEHOLDER_GREETING).toBe('home.greetingMorning')
    expect(GREETING_KEYS).toContain(PLACEHOLDER_GREETING)
  })
})
