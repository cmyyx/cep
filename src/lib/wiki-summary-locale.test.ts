import { expect, it } from 'vitest'
import { entityNameZhCN, equipmentModelKeyFromZhCN, localizeWikiEntitySummary } from './wiki-summary-locale'
import type { WikiCharacterSummary, WikiEquipmentSummary } from '@/types/wiki'

const character = {
  id: 'chr_test',
  category: 'characters',
  name: { 'zh-CN': '测试干员', en: 'Test Op', ja: 'テスト', 'zh-TW': '測試幹員' },
  rarity: 5,
  imageId: 'chr_test',
  elementId: 'Physical',
  professionId: '0',
  factionId: 'f',
  weaponTypeId: 'sword',
  mainAttributeId: '39',
  subAttributeId: '40',
} satisfies WikiCharacterSummary

const equipment = {
  id: 'eq_test',
  category: 'equipment',
  name: { 'zh-CN': '测试装', en: 'Test Eq', ja: '装備', 'zh-TW': '測試裝' },
  rarity: 4,
  imageId: 'eq_test',
  partTypeId: '0',
  suitId: 'suit_a',
  suitName: { 'zh-CN': '套装甲', en: 'Suit A', ja: 'セットA', 'zh-TW': '套裝甲' },
  minimumLevel: 20,
} satisfies WikiEquipmentSummary

it('localizes summary names to the active locale and keeps zh-CN for UP matching', () => {
  const en = localizeWikiEntitySummary(character, 'en')
  expect(en.name).toBe('Test Op')
  expect(en.nameZhCN).toBe('测试干员')
  expect(entityNameZhCN(en)).toBe('测试干员')

  const zh = localizeWikiEntitySummary(character, 'zh-CN')
  expect(zh.name).toBe('测试干员')
  expect(zh.nameZhCN).toBe('测试干员')
})

it('localizes equipment suit names', () => {
  const ja = localizeWikiEntitySummary(equipment, 'ja')
  expect(ja.name).toBe('装備')
  expect(ja.suitName).toBe('セットA')
  expect(ja).not.toHaveProperty('nameZhCN')
  expect(ja).not.toHaveProperty('modelKey')
})

it('resolves the model tier from the zh-CN name for every locale', () => {
  expect(equipmentModelKeyFromZhCN('测试型重甲·壹型')).toBe('refinement.modelTypeI')
  expect(equipmentModelKeyFromZhCN('重装信使手套·贰型')).toBe('refinement.modelTypeII')
  expect(equipmentModelKeyFromZhCN('某装备·Ⅲ型')).toBe('refinement.modelTypeIII')
  expect(equipmentModelKeyFromZhCN('测试型重甲')).toBeUndefined()

  const tiered = {
    ...equipment,
    name: { 'zh-CN': '测试装·贰型', en: 'Test Eq T2', ja: 'テストⅡ', 'zh-TW': '測試裝·II' },
  }
  for (const locale of ['zh-CN', 'zh-TW', 'ja', 'en'] as const) {
    expect(localizeWikiEntitySummary(tiered, locale).modelKey).toBe('refinement.modelTypeII')
  }
})
