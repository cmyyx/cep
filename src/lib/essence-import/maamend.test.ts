import { describe, expect, it } from 'vitest'
import { parseMaaEndEssence } from './maamend'
import { MAAEND_INVENTORY_FORMAT, MAAEND_PROTOCOL } from './protocol'

/** Term ids shared by wpn_sword_0012 and wpn_sword_0016 (see @/data/weapons). */
const SWORD_TERMS = ['gat_passive_attr_will', 'gat_passive_attr_atk', 'gst_passive_tacafter']
/** wpn_claym_0017 only. */
const CLAYM_TERMS = ['gat_passive_attr_str', 'gat_passive_attr_atk', 'gst_passive_phyabn']

function item(quality: string, mark: string, termIds: readonly string[]) {
  return {
    quality,
    mark,
    skills: termIds.map((id, index) => ({ id, level: index === 2 ? 3 : 6 })),
  }
}

/** A protocol-v1 inventory; `coverage` defaults to a complete 无瑕 scan. */
function inventory(overrides: Record<string, unknown> = {}) {
  return {
    format: MAAEND_INVENTORY_FORMAT,
    version: MAAEND_PROTOCOL.version,
    account_id: 'uid_hash',
    updated_at: '2026-11-22T04:05:06Z',
    coverage: { flawless_gold: { complete_at: '2026-11-22T04:05:06Z' } },
    items: [item('flawless_gold', 'lock', SWORD_TERMS)],
    ...overrides,
  }
}

function expectOk(result: ReturnType<typeof parseMaaEndEssence>) {
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.failure)}`)
  return result.summary
}

describe('parseMaaEndEssence: protocol v1 (current)', () => {
  it('maps skills onto the local weapon table without any weapon_ids', () => {
    const summary = expectOk(parseMaaEndEssence(inventory()))

    // Both swords share this exact term set, so one essence marks both
    expect(summary.weaponIds).toEqual(['wpn_sword_0012', 'wpn_sword_0016'])
    expect(summary.essenceCount).toBe(1)
    expect(summary.complete).toBe(true)
    expect(summary.protocolVersion).toBe(MAAEND_PROTOCOL.version)
    expect(summary.updatedAt).toBe('2026-11-22T04:05:06Z')
    expect(summary.unknownItems).toEqual([])
  })

  it('sums distinct essences and merges duplicates of the same term set', () => {
    const summary = expectOk(parseMaaEndEssence(inventory({
      items: [
        item('flawless_gold', 'none', SWORD_TERMS),
        item('flawless_gold', 'lock', SWORD_TERMS),
        item('flawless_gold', 'lock', CLAYM_TERMS),
      ],
    })))

    expect(summary.essenceCount).toBe(3)
    expect(summary.weaponIds).toEqual(['wpn_claym_0017', 'wpn_sword_0012', 'wpn_sword_0016'])
  })

  it('ignores discarded and non-flawless items', () => {
    const summary = expectOk(parseMaaEndEssence(inventory({
      items: [
        item('flawless_gold', 'discard', SWORD_TERMS),
        item('high_purity_purple', 'lock', CLAYM_TERMS),
        item('flawless_gold', 'lock', CLAYM_TERMS),
      ],
    })))

    expect(summary.essenceCount).toBe(1)
    expect(summary.weaponIds).toEqual(['wpn_claym_0017'])
    expect(summary.unknownItems).toEqual([])
  })

  it('reports term sets that match no weapon in the current dataset', () => {
    const unknown = ['gat_passive_attr_unknown', 'gat_passive_attr_atk', 'gst_passive_unknown']
    const summary = expectOk(parseMaaEndEssence(inventory({
      items: [item('flawless_gold', 'lock', SWORD_TERMS), item('flawless_gold', 'lock', unknown)],
    })))

    expect(summary.weaponIds).toEqual(['wpn_sword_0012', 'wpn_sword_0016'])
    expect(summary.unknownItems).toEqual([unknown.join(' + ')])
    // The entry is still an observed essence, it just maps to nothing we know
    expect(summary.essenceCount).toBe(2)
  })

  it('reports a 3-star two-term essence as unmatched (upstream only matches 4/5/6 stars)', () => {
    const summary = expectOk(parseMaaEndEssence(inventory({
      items: [item('flawless_gold', 'lock', ['gat_passive_attr_main', 'gst_passive_force'])],
    })))

    expect(summary.weaponIds).toEqual([])
    expect(summary.unknownItems).toEqual(['gat_passive_attr_main + gst_passive_force'])
  })

  it('treats a tier without complete_at as a partial scan', () => {
    const partial = expectOk(parseMaaEndEssence(inventory({
      coverage: { flawless_gold: { unread: 3 } },
    })))
    expect(partial.complete).toBe(false)

    const noTier = expectOk(parseMaaEndEssence(inventory({ coverage: {} })))
    expect(noTier.complete).toBe(false)
  })

  it('accepts the upstream aggregate coverage key', () => {
    const summary = expectOk(parseMaaEndEssence(inventory({
      coverage: { locked_matching_flawless_gold: { complete_at: '2026-11-22T04:05:06Z' } },
    })))
    expect(summary.complete).toBe(true)
  })

  it('accepts an empty complete inventory', () => {
    const summary = expectOk(parseMaaEndEssence(inventory({ items: [] })))
    expect(summary).toMatchObject({ weaponIds: [], essenceCount: 0, complete: true })
  })

  it('ignores unknown fields and unknown enum values (forward compatibility)', () => {
    const summary = expectOk(parseMaaEndEssence(inventory({
      future_field: { nested: true },
      items: [
        { ...item('flawless_gold', 'lock', SWORD_TERMS), future_mark_detail: 1 },
        item('future_quality', 'none', SWORD_TERMS),
      ],
    })))

    expect(summary.weaponIds).toEqual(['wpn_sword_0012', 'wpn_sword_0016'])
    expect(summary.essenceCount).toBe(1)
  })

  it('rejects a newer protocol version with its own reason instead of "corrupted"', () => {
    const result = parseMaaEndEssence(inventory({ version: MAAEND_PROTOCOL.version + 1 }))

    expect(result).toEqual({ ok: false, failure: { reason: 'unsupported_version', version: 2 } })
  })

  it('reports the failing field path so the user can describe the problem', () => {
    // Same version, broken payload: the path is what makes the report actionable
    expect(parseMaaEndEssence(inventory({ items: [{ quality: 'flawless_gold' }] }))).toEqual({
      ok: false,
      failure: { reason: 'invalid', issuePath: 'items[0].mark' },
    })
    expect(
      parseMaaEndEssence(inventory({
        items: [{ quality: 'flawless_gold', mark: 'lock', skills: [{ id: 'gat_x', level: 0 }] }],
      })),
    ).toEqual({
      ok: false,
      failure: { reason: 'invalid', issuePath: 'items[0].skills[0].level' },
    })
    expect(parseMaaEndEssence(inventory({ coverage: 'nope' }))).toEqual({
      ok: false,
      failure: { reason: 'invalid', issuePath: 'coverage' },
    })
  })

  it('reports a payload that is not a MaaEND inventory at all without a path', () => {
    const invalid = { ok: false, failure: { reason: 'invalid', issuePath: null } }
    expect(parseMaaEndEssence(inventory({ format: 'something.else' }))).toEqual(invalid)
    expect(parseMaaEndEssence(null)).toEqual(invalid)
    expect(parseMaaEndEssence({ version: 1, items: [] })).toEqual(invalid)
  })
})

describe('parseMaaEndEssence: retired array format', () => {
  it('rejects the legacy array without trying to migrate it', () => {
    const legacy = [
      { weapon_ids: ['wpn_sword_0012'], essences: [{ levels: [6, 6, 3], count: 1 }] },
    ]

    expect(parseMaaEndEssence(legacy)).toEqual({
      ok: false,
      failure: { reason: 'legacy_unsupported' },
    })
  })

  it('reports even an empty array as legacy rather than as a valid empty scan', () => {
    // An empty array used to mean "complete scan, nothing found"; that reading is
    // gone with the format, so it must not silently clear anyone's marks.
    expect(parseMaaEndEssence([])).toEqual({
      ok: false,
      failure: { reason: 'legacy_unsupported' },
    })
  })
})
