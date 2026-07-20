import { expect, it } from 'vitest'
import { getWikiEntityUpStatus, groupWikiEquipmentBySuit, sortWikiEntities } from './wiki-entity-grid'
import type { WikiCharacterSummary, WikiEquipmentSummary, WikiWeaponSummary } from '@/types/wiki'

const localized = (zhCN: string, en = zhCN) => ({
  'zh-CN': zhCN,
  en,
  ja: zhCN,
  'zh-TW': zhCN,
})

const character = (id: string, name: string, rarity: number): WikiCharacterSummary => ({
  id,
  category: 'characters',
  name: localized(name),
  rarity,
  imageId: id,
  elementId: 'Physical',
  professionId: '0',
  factionId: 'ENDFIELD INDUSTRIES',
  weaponTypeId: '1',
  mainAttributeId: '39',
  subAttributeId: '40',
})

it('sorts by rarity descending and localized name ascending', () => {
  const entities = [
    character('four', '四星', 4),
    character('six-b', '乙', 6),
    character('five', '五星', 5),
    character('six-a', '甲', 6),
  ]

  expect(sortWikiEntities(entities, 'zh-CN').map((entity) => entity.id)).toEqual([
    'six-a',
    'six-b',
    'five',
    'four',
  ])
})

it('marks current characters and their associated weapons as UP', () => {
  const weapon: WikiWeaponSummary = {
    id: 'wpn_test',
    category: 'weapons',
    name: localized('测试武器'),
    rarity: 6,
    imageId: 'wpn_test',
    weaponTypeId: '1',
    maxLevel: 90,
  }
  const equipment: WikiEquipmentSummary = {
    id: 'equip_test',
    category: 'equipment',
    name: localized('测试装备'),
    rarity: 5,
    imageId: 'equip_test',
    partTypeId: '0',
    minimumLevel: 80,
  }
  const upNames = new Set(['诀'])
  const weaponCharacters = new Map([['wpn_test', ['诀']]])

  expect(getWikiEntityUpStatus(character('chr_test', '诀', 6), upNames, weaponCharacters)).toBe(true)
  expect(getWikiEntityUpStatus(weapon, upNames, weaponCharacters)).toBe(true)
  expect(getWikiEntityUpStatus(equipment, upNames, weaponCharacters)).toBe(false)
})

it('puts independent equipment first and sorts sets and members by rarity', () => {
  const entities: WikiEquipmentSummary[] = [
    { ...({} as WikiEquipmentSummary), id: 'a-low', category: 'equipment', name: localized('A Low'), rarity: 3, imageId: 'a-low', partTypeId: '0', minimumLevel: 20, suitId: 'suit-a', suitName: localized('套装甲') },
    { ...({} as WikiEquipmentSummary), id: 'a-high', category: 'equipment', name: localized('A High'), rarity: 5, imageId: 'a-high', partTypeId: '2', minimumLevel: 20, suitId: 'suit-a', suitName: localized('套装甲') },
    { ...({} as WikiEquipmentSummary), id: 'b', category: 'equipment', name: localized('B'), rarity: 6, imageId: 'b', partTypeId: '1', minimumLevel: 80, suitId: 'suit-b', suitName: localized('套装乙') },
    { ...({} as WikiEquipmentSummary), id: 'independent', category: 'equipment', name: localized('独立'), rarity: 1, imageId: 'independent', partTypeId: '1', minimumLevel: 10 },
  ]

  expect(groupWikiEquipmentBySuit(entities, 'zh-CN', '独立装备')).toEqual([
    { key: '__no-set__', label: '独立装备', entities: [entities[3]] },
    { key: 'suit-b', label: '套装乙', entities: [entities[2]] },
    { key: 'suit-a', label: '套装甲', entities: [entities[1], entities[0]] },
  ])
})
