import { describe, expect, it } from 'vitest'
import { parseMaaEndEssence } from './maamend'

describe('parseMaaEndEssence', () => {
  it('folds a valid inventory into a sorted, deduped weapon id list', () => {
    const summary = parseMaaEndEssence([
      {
        weapon_ids: ['wpn_sword_0016', 'wpn_sword_0012'],
        essences: [
          { levels: [3, 2, 1], count: 2 },
          { levels: [6, 6, 3], count: 1 },
        ],
      },
      {
        weapon_ids: ['wpn_sword_0012', 'wpn_claym_0017'],
        essences: [{ levels: [6, 6, 3], count: 1 }],
      },
    ])

    expect(summary).not.toBeNull()
    expect(summary?.weaponIds).toEqual(['wpn_claym_0017', 'wpn_sword_0012', 'wpn_sword_0016'])
    expect(summary?.groupCount).toBe(2)
    // counts are summed, not multiplied by the number of weapons
    expect(summary?.essenceCount).toBe(4)
    expect(summary?.unknownWeaponIds).toEqual([])
  })

  it('separates weapon ids that are not in the current dataset', () => {
    const summary = parseMaaEndEssence([
      {
        weapon_ids: ['wpn_sword_0012', 'wpn_sword_9999'],
        essences: [{ levels: [6, 6, 3], count: 1 }],
      },
    ])

    expect(summary?.weaponIds).toEqual(['wpn_sword_0012'])
    expect(summary?.unknownWeaponIds).toEqual(['wpn_sword_9999'])
  })

  it('accepts the empty inventory (a complete scan that found nothing)', () => {
    expect(parseMaaEndEssence([])).toEqual({
      groupCount: 0,
      essenceCount: 0,
      weaponIds: [],
      unknownWeaponIds: [],
    })
  })

  it('rejects malformed payloads instead of silently importing junk', () => {
    // levels must be [1-6, 1-6, 1-3]; count must be >= 1; weapon_ids must be wpn_*
    expect(parseMaaEndEssence([{ weapon_ids: ['sword'], essences: [{ levels: [1, 1, 1], count: 1 }] }])).toBeNull()
    expect(parseMaaEndEssence([{ weapon_ids: [], essences: [{ levels: [1, 1, 1], count: 1 }] }])).toBeNull()
    expect(parseMaaEndEssence([{ weapon_ids: ['wpn_sword_0012'], essences: [] }])).toBeNull()
    expect(parseMaaEndEssence([{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [7, 1, 1], count: 1 }] }])).toBeNull()
    expect(parseMaaEndEssence([{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 0 }] }])).toBeNull()
    expect(parseMaaEndEssence([{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1], count: 1 }] }])).toBeNull()
    expect(parseMaaEndEssence([{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1, extra: true }] }])).toBeNull()
    expect(parseMaaEndEssence([{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1 }], extra: 1 }])).toBeNull()
  })

  it('rejects non-array payloads', () => {
    expect(parseMaaEndEssence(null)).toBeNull()
    expect(parseMaaEndEssence({ weapon_ids: ['wpn_sword_0012'] })).toBeNull()
  })
})
