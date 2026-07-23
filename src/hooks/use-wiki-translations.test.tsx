// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useWikiTranslations } from './use-wiki-translations'
import type { WikiCharacterSummary, WikiEquipmentSummary, WikiWeaponSummary } from '@/types/wiki'

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
}))

vi.mock('@/lib/game-i18n-catalogs', () => {
  const catalogs = {
    characters: { chr_test: '测试角色' },
    weapons: { wpn_test: '测试武器' },
    equips: { equip_test: '测试装备' },
    equipStats: { AllSkillDamageIncrease: '所有技能伤害加成' },
    wikiData: {
      'enum|attributes|39': '力量',
      'item|item_test': '测试材料',
      'suit|suit_test': '测试套装',
      'character|chr_test|skill|skill%2Etest|name': '带点号的技能',
    },
  } as const

  type Namespace = keyof typeof catalogs

  return {
    hasGameI18n: (locale: string, namespace: Namespace, key: string) =>
      locale === 'zh-CN' && key in catalogs[namespace],
    lookupGameI18n: (locale: string, namespace: Namespace, key: string) =>
      locale === 'zh-CN' ? catalogs[namespace][key as keyof (typeof catalogs)[Namespace]] : undefined,
  }
})

const localized = (value: string) => ({ 'zh-CN': value, en: value, ja: value, 'zh-TW': value })

const character: WikiCharacterSummary = {
  id: 'chr_test',
  category: 'characters',
  name: localized('角色'),
  rarity: 6,
  imageId: 'chr_test',
  elementId: 'Physical',
  professionId: '0',
  factionId: 'test',
  weaponTypeId: '1',
  mainAttributeId: '39',
  subAttributeId: '40',
}

const weapon: WikiWeaponSummary = {
  id: 'wpn_test',
  category: 'weapons',
  name: localized('武器'),
  rarity: 6,
  imageId: 'wpn_test',
  weaponTypeId: '1',
  maxLevel: 90,
}

const equipment: WikiEquipmentSummary = {
  id: 'equip_test',
  category: 'equipment',
  name: localized('装备'),
  rarity: 5,
  imageId: 'equip_test',
  partTypeId: '0',
  minimumLevel: 80,
}

it('translates all wiki entity categories and falls back to missing IDs', () => {
  const { result } = renderHook(() => useWikiTranslations())

  expect(result.current.entityName(character)).toBe('测试角色')
  expect(result.current.entityName(weapon)).toBe('测试武器')
  expect(result.current.entityName(equipment)).toBe('测试装备')
  expect(result.current.entityName({ ...character, id: 'missing_character' })).toBe('missing_character')
  expect(result.current.enumLabel('attributes', '39')).toBe('力量')
  expect(result.current.itemName('item_test')).toBe('测试材料')
  expect(result.current.suitName('suit_test')).toBe('测试套装')
  expect(result.current.itemName('missing_item')).toBe('missing_item')
  expect(result.current.text('character', 'chr_test', 'skill', 'skill.test', 'name')).toBe('带点号的技能')
  expect(result.current.text('character', 'chr_test', 'skill', 'missing.skill', 'name')).toBe('name')
})

it('resolves equipment modifier labels before falling back to attribute enums', () => {
  const { result } = renderHook(() => useWikiTranslations())

  expect(result.current.equipmentStatLabel('AllSkillDamageIncrease')).toBe('所有技能伤害加成')
  expect(result.current.equipmentStatLabel('39')).toBe('力量')
  expect(result.current.equipmentStatLabel('UnknownModifier')).toBe('UnknownModifier')
})
