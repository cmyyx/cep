import { describe, expect, it } from 'vitest'
import { parseMaaEndEssenceInventory } from './maaend-essence-import'

describe('parseMaaEndEssenceInventory', () => {
  it('marks every compatible weapon even when they share one low-level essence', () => {
    const inventory = [{
      weapon_ids: ['wpn_sword_0012', 'wpn_sword_0016'],
      essences: [{ levels: [1, 1, 1], count: 1 }],
    }]

    expect(parseMaaEndEssenceInventory(JSON.stringify(inventory))).toEqual({
      ok: true,
      weaponIds: ['wpn_sword_0012', 'wpn_sword_0016'],
      unknownWeaponIds: [],
    })
  })

  it('reports unknown weapons without discarding known compatible weapons', () => {
    expect(parseMaaEndEssenceInventory(JSON.stringify([{
      weapon_ids: ['wpn_sword_0012', 'wpn_future_9999'],
      essences: [{ levels: [6, 6, 3], count: 50 }],
    }]))).toEqual({
      ok: true,
      weaponIds: ['wpn_sword_0012'],
      unknownWeaponIds: ['wpn_future_9999'],
    })
  })

  it('rejects a nonempty scan with no supported weapons', () => {
    expect(parseMaaEndEssenceInventory(JSON.stringify([{
      weapon_ids: ['wpn_future_9999'],
      essences: [{ levels: [1, 1, 1], count: 1 }],
    }]))).toEqual({ ok: false, error: 'unknownOnly', unknownWeaponIds: ['wpn_future_9999'] })
  })

  it('accepts a complete empty scan and a UTF-8 BOM', () => {
    expect(parseMaaEndEssenceInventory('\uFEFF[]')).toEqual({ ok: true, weaponIds: [], unknownWeaponIds: [] })
  })

  it('deduplicates compatible IDs across groups regardless of their levels and counts', () => {
    expect(parseMaaEndEssenceInventory(JSON.stringify([
      { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1 }] },
      { weapon_ids: ['wpn_sword_0012', 'wpn_sword_0016'], essences: [{ levels: [6, 6, 3], count: 100 }] },
    ]))).toEqual({ ok: true, weaponIds: ['wpn_sword_0012', 'wpn_sword_0016'], unknownWeaponIds: [] })
  })

  it('distinguishes invalid JSON from an invalid inventory', () => {
    expect(parseMaaEndEssenceInventory('{')).toEqual({ ok: false, error: 'invalidJson', unknownWeaponIds: [] })
  })

  it.each([
    null,
    {},
    { version: 1, modules: {} },
    [{ weapon_ids: [], essences: [{ levels: [1, 1, 1], count: 1 }] }],
    [{ weapon_ids: ['wpn_sword_0012', 'wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1 }] }],
    [{ weapon_ids: ['custom-test'], essences: [{ levels: [1, 1, 1], count: 1 }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [0, 1, 1], count: 1 }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 7, 1], count: 1 }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 4], count: 1 }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1.5, 1], count: 1 }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1, 1], count: 1 }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 0 }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: '1' }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1, extra: true }] }],
    [{ weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1 }], extra: true }],
    [
      { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [1, 1, 1], count: 1 }] },
      { weapon_ids: ['wpn_sword_0016'], essences: [{ levels: [1, 1, 1], count: 0 }] },
    ],
  ])('rejects invalid structure without producing partial marks: %j', (input) => {
    expect(parseMaaEndEssenceInventory(JSON.stringify(input))).toEqual({ ok: false, error: 'invalidFormat', unknownWeaponIds: [] })
  })
})
