import { describe, expect, it } from 'vitest'
import { foresightWeaponIds, isForesightWeapon } from './foresight-weapons'

describe('isForesightWeapon', () => {
  it('recognises every weapon from the generated foresight table', () => {
    const ids = foresightWeaponIds()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(isForesightWeapon(id)).toBe(true)
  })

  it('is false for released weapons and unknown ids', () => {
    expect(isForesightWeapon('wpn_claym_0007')).toBe(false)
    expect(isForesightWeapon('wpn_sword_0023')).toBe(false)
    expect(isForesightWeapon('')).toBe(false)
    expect(isForesightWeapon('preview:玉中身')).toBe(false)
  })
})
