import { describe, it, expect } from 'vitest'
import { cn, formatTime } from './utils'

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('filters falsy values', () => {
    expect(cn('a', false && 'c', undefined, null, '', 'b')).toBe('a b')
  })

  it('resolves Tailwind conflicts via twMerge', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('formatTime', () => {
  it('formats ISO string to readable format', () => {
    const result = formatTime('2025-01-15T08:30:00.000Z')
    expect(result).toMatch(/^2025-01-15 \d{2}:\d{2}$/)
  })

  it('pads single-digit months and days', () => {
    const result = formatTime('2025-03-05T00:00:00.000Z')
    expect(result).toMatch(/^2025-03-05/)
  })

  it('returns empty string for empty input', () => {
    expect(formatTime('')).toBe('')
  })

  it('returns empty string for invalid date', () => {
    expect(formatTime('not-a-date')).toBe('')
  })
})
