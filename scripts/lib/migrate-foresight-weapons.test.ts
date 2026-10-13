import { describe, expect, it } from 'vitest'
import { migrateForesightWeaponsFile, type ForesightWeaponTarget } from './migrate-foresight-weapons'

/** 精简自真实 `src/data/weapons.ts` 的前瞻块 (1.6 前瞻: 玉中身 / 悠久传承 / 唤月 / 聚合工业)。 */
const WEAPONS_TS = `import type { Weapon } from '@/types/matrix'

export const weapons: Weapon[] = [
  { id: 'preview:玉中身', name: '玉中身', rarity: 6, type: '双手剑', primaryStat: 'gat_passive_attr_wisd', elementalDamage: 'gat_passive_attr_icedam', specialAbility: 'gst_passive_keyword', chars: ['祀'], source: 'preview' },
  { id: 'preview:悠久传承', name: '悠久传承', rarity: 6, type: '双手剑', primaryStat: 'gat_passive_attr_wisd', elementalDamage: 'gat_passive_attr_icedam', specialAbility: 'gst_passive_keyword', chars: [], source: 'preview' },
  { id: 'preview:唤月', name: '唤月', rarity: 6, type: '单手剑', primaryStat: 'gat_passive_attr_will', elementalDamage: 'gat_passive_attr_atk', specialAbility: 'gst_passive_magabn', chars: ['明河'], source: 'preview' },
  { id: 'wpn_sword_0023', name: '点心时刻', rarity: 5, type: '单手剑', primaryStat: 'gat_passive_attr_str', elementalDamage: 'gat_passive_attr_heal', specialAbility: 'gst_passive_heal', chars: ['噗切娜'] },
]
`

const TARGETS: ForesightWeaponTarget[] = [
  { formalId: 'wpn_claym_0018', previewId: 'preview:玉中身', name: '玉中身', rarity: 6, weaponTypeId: '3', gemTagIds: ['attr_wisd', 'attr_icedam', 'keyword'], iconId: 'wpn_claym_0018' },
  { formalId: 'wpn_claym_0019', previewId: 'preview:悠久传承', name: '悠久传承', rarity: 6, weaponTypeId: '3', gemTagIds: ['attr_icedam', 'attr_wisd', 'keyword'], iconId: 'wpn_claym_0019' },
  { formalId: 'wpn_sword_0025', previewId: 'preview:唤月', name: '唤月', rarity: 6, weaponTypeId: '1', gemTagIds: ['attr_will', 'attr_atk', 'magabn'], iconId: 'wpn_sword_0025' },
]

describe('migrateForesightWeaponsFile', () => {
  it('replaces the preview id with the formal id and keeps source: preview', () => {
    const { content, migrated, skipped } = migrateForesightWeaponsFile(WEAPONS_TS, TARGETS)
    expect(migrated).toEqual([
      { previewId: 'preview:玉中身', formalId: 'wpn_claym_0018' },
      { previewId: 'preview:悠久传承', formalId: 'wpn_claym_0019' },
      { previewId: 'preview:唤月', formalId: 'wpn_sword_0025' },
    ])
    expect(skipped).toEqual([])
    // 正式 id + 前瞻状态 (徽标) 同时存在
    expect(content).toContain("id: 'wpn_claym_0018'")
    expect(content).toContain("id: 'wpn_sword_0025'")
    expect(content).toMatch(/id: 'wpn_claym_0018'[^\n]*source: 'preview'/)
    expect(content).not.toContain('preview:玉中身')
    // 已上线武器原样保留
    expect(content).toContain("id: 'wpn_sword_0023'")
  })

  it('is idempotent: a second run reports already-migrated entries', () => {
    const first = migrateForesightWeaponsFile(WEAPONS_TS, TARGETS)
    const second = migrateForesightWeaponsFile(first.content, TARGETS)
    expect(second.migrated).toEqual([])
    expect(second.already).toHaveLength(3)
    expect(second.content).toBe(first.content)
  })

  it('refuses to migrate when the hand-written entry disagrees with upstream', () => {
    // 名称对不上 (匹配错了) → 不迁移
    const wrongName = TARGETS.map((target) => (target.formalId === 'wpn_claym_0018' ? { ...target, name: '别的名字' } : target))
    const nameResult = migrateForesightWeaponsFile(WEAPONS_TS, wrongName)
    expect(nameResult.migrated.map((entry) => entry.formalId)).not.toContain('wpn_claym_0018')
    expect(nameResult.skipped.some((reason) => reason.includes('name'))).toBe(true)

    // 宝石标签对不上 → 不迁移
    const wrongTags = TARGETS.map((target) => (target.formalId === 'wpn_sword_0025' ? { ...target, gemTagIds: ['attr_str', 'attr_atk', 'magabn'] } : target))
    const tagResult = migrateForesightWeaponsFile(WEAPONS_TS, wrongTags)
    expect(tagResult.migrated.map((entry) => entry.formalId)).not.toContain('wpn_sword_0025')
    expect(tagResult.skipped.some((reason) => reason.includes('gemTagIds'))).toBe(true)
  })

  it('never migrates into an id that already exists, and never collides two previews', () => {
    const existing = migrateForesightWeaponsFile(WEAPONS_TS, [TARGETS[0], { ...TARGETS[1], formalId: 'wpn_claym_0018' }])
    expect(existing.migrated).toEqual([{ previewId: 'preview:玉中身', formalId: 'wpn_claym_0018' }])
    expect(existing.skipped.some((reason) => reason.includes('已被占用'))).toBe(true)
    expect(existing.content.match(/id: 'wpn_claym_0018'/g)).toHaveLength(1)
  })

  it('reports targets that are neither a preview entry nor a formal entry', () => {
    const missing = migrateForesightWeaponsFile(WEAPONS_TS, [{ ...TARGETS[0], formalId: 'wpn_claym_0099', previewId: 'preview:不存在' }])
    expect(missing.migrated).toEqual([])
    expect(missing.skipped.some((reason) => reason.includes('找不到'))).toBe(true)
  })

  it('adds the foresight state when a preview entry lacks source', () => {
    const withoutSource = WEAPONS_TS.replace(", source: 'preview' }", ' }')
    const { content, repaired } = migrateForesightWeaponsFile(withoutSource, [TARGETS[0]])
    expect(repaired).toEqual(['wpn_claym_0018'])
    expect(content).toMatch(/id: 'wpn_claym_0018'[^\n]*source: 'preview'[^\n]*\},$/m)
  })

  it('adds the foresight state on an entry that already uses the formal id', () => {
    const formal = WEAPONS_TS.replace("id: 'preview:玉中身', name: '玉中身'", "id: 'wpn_claym_0018', name: '玉中身'").replace(", chars: ['祀'], source: 'preview' }", ", chars: ['祀'] }")
    const { content, migrated, already, repaired } = migrateForesightWeaponsFile(formal, [TARGETS[0]])
    expect(migrated).toEqual([])
    expect(already).toHaveLength(1)
    expect(repaired).toEqual(['wpn_claym_0018'])
    expect(content).toMatch(/id: 'wpn_claym_0018'[^\n]*source: 'preview'[^\n]*\},$/m)
  })
})
