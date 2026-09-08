import { expect, it } from 'vitest'
import { rawEquipmentDetail, rawEquipmentSummary, rawWeaponDetail, rawWeaponSummary } from './raw-wiki-data'

it('writes structural weapon data without localized payloads', () => {
  const localized = { 'zh-CN': '中文', en: 'English', ja: '日本語', 'zh-TW': '繁中' }
  const summary = rawWeaponSummary({
    id: 'wpn_test',
    category: 'weapons',
    name: localized,
    rarity: 5,
    imageId: 'wpn_test',
    weaponTypeId: '1',
    maxLevel: 90,
  })
  const detail = rawWeaponDetail({
    id: 'wpn_test',
    category: 'weapons',
    maxLevel: 90,
    levels: [{ level: 1, baseAttack: 10 }],
    breakthroughs: [{ stage: 1, requiredLevel: 20, stats: [], materials: [] }],
    skills: [{ id: 'skill_test', name: localized, description: localized, levels: [{ level: 1, description: localized }] }],
  })

  expect(summary).not.toHaveProperty('name')
  expect(detail).not.toHaveProperty('skills.0.name')
  expect(JSON.stringify(detail)).not.toContain('zh-CN')
})

it('keeps structural equipment model keys while stripping localized names', () => {
  const raw = rawEquipmentSummary({
    id: 'item_equip_t1_suit_stragi01_body_01',
    category: 'equipment',
    name: { 'zh-CN': '力量·壹型', en: 'Strength · I', ja: 'ストレングス·Ⅰ型', 'zh-TW': '力量·I' },
    rarity: 5,
    imageId: 'item_equip_t1_suit_stragi01_body_01',
    partTypeId: '0',
    suitId: 'suit_test',
    suitName: { 'zh-CN': '力量套装', en: 'Strength Set', ja: 'ストレングス', 'zh-TW': '力量套裝' },
    minimumLevel: 20,
  })
  expect(raw).not.toHaveProperty('name')
  expect(raw).not.toHaveProperty('suitName')
  expect(raw).toHaveProperty('modelKey', 'refinement.modelTypeI')
})

it('moves equipment display text out of structural detail data', () => {
  const raw = rawEquipmentDetail({
    id: 'item_equip_test',
    category: 'equipment',
    stats: [{ attributeId: '3', values: [1], displayValues: ['防御力+1'] }],
    suitEffects: [],
    craftingRecipes: [],
  })
  expect(raw).not.toHaveProperty('stats.0.displayValues')
})
