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

  it('every weapon has required string fields', () => {
    for (const w of weapons) {
      expect(w.id).toBeTruthy()
      expect(w.name).toBeTruthy()
      expect(w.type).toBeTruthy()
      expect(w.primaryStat).toBeTruthy()
      expect(w.elementalDamage).toBeTruthy()
      expect(w.specialAbility).toBeTruthy()
    }
  })

  it('every weapon has valid rarity', () => {
    for (const w of weapons) {
      expect([4, 5, 6]).toContain(w.rarity)
    }
  })

  it('every weapon has a chars array', () => {
    for (const w of weapons) {
      expect(Array.isArray(w.chars)).toBe(true)
    }
  })

  it('every weapon has an imageId', () => {
    for (const w of weapons) {
      expect(w.imageId).toBeTruthy()
    }
  })
})
