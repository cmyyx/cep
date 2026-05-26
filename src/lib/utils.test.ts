import { describe, it, expect } from 'vitest'
import { cn, formatTime, stripMaterialQuantity } from './utils'

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

describe('stripMaterialQuantity', () => {
  it('strips "x20" quantity suffix', () => {
    expect(stripMaterialQuantity('协议圆盘 x20')).toBe('协议圆盘')
  })

  it('strips "x1.6k" quantity suffix', () => {
    expect(stripMaterialQuantity('折金票 x1.6k')).toBe('折金票')
  })

  it('strips "x1.6K" quantity suffix (uppercase K)', () => {
    expect(stripMaterialQuantity('折金票 x1.6K')).toBe('折金票')
  })

  it('returns empty string for empty input', () => {
    expect(stripMaterialQuantity('')).toBe('')
  })

  it('returns name unchanged when no quantity suffix', () => {
    expect(stripMaterialQuantity('协议圆盘')).toBe('协议圆盘')
  })

  it('trims leading/trailing whitespace', () => {
    expect(stripMaterialQuantity('  协议圆盘  ')).toBe('协议圆盘')
  })
})
