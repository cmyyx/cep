import { describe, expect, it } from 'vitest'
import { gameDisplayValue } from './game-display-value'

describe('gameDisplayValue', () => {
  it('floors non-percent attribute values to integers', () => {
    expect(gameDisplayValue(25327.8664707)).toBe(25327)
    expect(gameDisplayValue(105.6340205)).toBe(105)
    expect(gameDisplayValue(1234567.89)).toBe(1234567)
    expect(gameDisplayValue(695.41174)).toBe(695)
  })

  it('rounds at 1e-5 before flooring, so float noise cannot drop a whole point', () => {
    // 游戏先 lume.round(v*1e5)/1e5 再 floor; 直接 floor 会得到 25327
    expect(gameDisplayValue(25327.999999999)).toBe(25328)
    expect(gameDisplayValue(8.7599999999)).toBe(8)
    expect(gameDisplayValue(0.999999999)).toBe(1)
  })

  it('passes integers through and handles negatives toward negative infinity', () => {
    expect(gameDisplayValue(0)).toBe(0)
    expect(gameDisplayValue(3475)).toBe(3475)
    expect(gameDisplayValue(-3.2)).toBe(-4)
    expect(gameDisplayValue(-3)).toBe(-3)
  })

  it('normalizes non-finite input to zero', () => {
    expect(gameDisplayValue(Number.NaN)).toBe(0)
    expect(gameDisplayValue(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
