import { describe, it, expect } from 'vitest'
import { weapons } from './weapons'

describe('weapons data', () => {
  it('contains weapons', () => {
    expect(weapons.length).toBeGreaterThan(0)
  })

  it('every weapon has a unique id', () => {
    const ids = weapons.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every weapon has required fields and only three-star weapons omit their elemental slot', () => {
    for (const weapon of weapons) {
      expect(weapon.id).toBeTruthy()
      expect(weapon.name).toBeTruthy()
      expect(weapon.type).toBeTruthy()
      expect(weapon.primaryStat).toBeTruthy()
      if (weapon.rarity === 3) {
        expect(weapon.elementalDamage).toBeNull()
        expect(weapon.specialAbility).toBeTruthy()
      } else {
        expect(weapon.elementalDamage).toBeTruthy()
        expect(weapon.specialAbility).toBeTruthy()
      }
    }
  })

  it('contains the five upstream three-star weapons with valid rarities', () => {
    expect(weapons.filter((weapon) => weapon.rarity === 3).map((weapon) => weapon.id).sort()).toEqual([
      'wpn_claym_0010',
      'wpn_funnel_0002',
      'wpn_lance_0009',
      'wpn_pistol_0001',
      'wpn_sword_0003',
    ])
    for (const weapon of weapons) expect([3, 4, 5, 6]).toContain(weapon.rarity)
  })

  it('every weapon has a chars array', () => {
    for (const w of weapons) {
      expect(Array.isArray(w.chars)).toBe(true)
    }
  })

  it('every weapon has an imageId', () => {
    for (const w of weapons) {
      expect(w.id).toBeTruthy()
    }
  })
})
