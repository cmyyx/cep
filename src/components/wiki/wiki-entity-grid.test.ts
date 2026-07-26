import { expect, it } from 'vitest'
import {
  getWikiEntityUpStatus,
  getWikiEquipmentModelKey,
  groupWikiEntities,
  groupWikiEquipmentBySuit,
  isWikiGroupExpanded,
  sortWikiEntities,
} from './wiki-entity-grid'
import { localizeWikiEntitySummary } from '@/lib/wiki-summary-locale'
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

it('sorts by rarity descending then localized name ascending', () => {
  const entities = [
    character('four', 'A', 4),
    character('six-b', 'B', 6),
    character('five', 'C', 5),
    character('six-a', 'D', 6),
  ]

  expect(sortWikiEntities(entities, 'zh-CN', undefined, (entity) => typeof entity.name === 'string' ? entity.name : entity.name['zh-CN']).map((entity) => entity.id)).toEqual([
    'six-b',
    'six-a',
    'five',
    'four',
  ])
})

it('pins UP entities before rarity and name sorting', () => {
  const entities = [
    character('b', 'B', 6),
    character('up-c', 'C', 5),
    character('a', 'A', 4),
  ]

  expect(sortWikiEntities(entities, 'zh-CN', (entity) => entity.id === 'up-c').map((entity) => entity.id)).toEqual([
    'up-c',
    'b',
    'a',
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

it('keeps the build-time localized suit label instead of the raw suit id', () => {
  const suitEquipment: WikiEquipmentSummary = {
    id: 'item_equip_suit_member',
    category: 'equipment',
    name: localized('套装甲护手', 'Suit A Gloves'),
    rarity: 5,
    imageId: 'item_equip_suit_member',
    partTypeId: '1',
    minimumLevel: 80,
    suitId: 'suit_a',
    suitName: localized('套装甲', 'Suit A'),
  }
  const localizedEntity = localizeWikiEntitySummary(suitEquipment, 'en')
  if (localizedEntity.category !== 'equipment') throw new Error('expected equipment summary')

  const [group] = groupWikiEquipmentBySuit([localizedEntity], 'en', 'No set')
  expect(group.key).toBe('suit_a')
  expect(group.label).toBe('Suit A')
})

it('force-expands suit groups while the list is narrowed by search or filters', () => {
  expect(isWikiGroupExpanded('suit_a', [], false)).toBe(false)
  expect(isWikiGroupExpanded('suit_a', ['suit_a'], false)).toBe(true)
  expect(isWikiGroupExpanded('suit_a', [], true)).toBe(true)
})

const elementLabels: Record<string, string> = { Physical: '物理', Natural: '自然' }

it('groups characters by the canonical enum order passed from the server', () => {
  const entities = [
    character('natural', '自然', 6),
    { ...character('physical', '物理', 5), elementId: 'Physical' },
  ]
  entities[0].elementId = 'Natural'
  const labelFor = (_group: 'elements' | string, id: string) => elementLabels[id] ?? id

  expect(
    groupWikiEntities(entities, { field: 'elementId', enumGroup: 'elements' }, 'zh-CN', labelFor, ['Physical', 'Natural'])
      .map((group) => [group.key, group.label]),
  ).toEqual([
    ['Physical', '物理'],
    ['Natural', '自然'],
  ])
})

it('falls back to label collation when no enum order is provided', () => {
  const entities = [
    { ...character('natural', '自然', 6), elementId: 'Natural' },
    { ...character('physical', '物理', 5), elementId: 'Physical' },
  ]
  // Labels chosen so collation order (Blaze < Zephyr) differs from insertion order.
  const labelFor = (_group: string, id: string) => (id === 'Natural' ? 'Zephyr' : 'Blaze')

  expect(
    groupWikiEntities(entities, { field: 'elementId', enumGroup: 'elements' }, 'en', labelFor).map((group) => group.key),
  ).toEqual(['Physical', 'Natural'])

  // Ids outside the provided order sort after the known ones.
  expect(
    groupWikiEntities(entities, { field: 'elementId', enumGroup: 'elements' }, 'en', labelFor, ['Natural'])
      .map((group) => group.key),
  ).toEqual(['Natural', 'Physical'])
})

const modelEquipment: WikiEquipmentSummary = {
  id: 'item_equip_model',
  category: 'equipment',
  name: {
    'zh-CN': '长息蓄电核·贰型',
    en: 'Longbreath Cell T2',
    ja: '長息蓄電コアⅡ',
    'zh-TW': '長息蓄電核·II',
  },
  rarity: 5,
  imageId: 'item_equip_model',
  partTypeId: '2',
  minimumLevel: 80,
}

it('resolves the equipment model badge for every locale, not only zh-CN spellings', () => {
  expect(getWikiEquipmentModelKey(modelEquipment)).toBe('refinement.modelTypeII')

  for (const locale of ['zh-CN', 'zh-TW', 'ja', 'en'] as const) {
    expect(getWikiEquipmentModelKey(localizeWikiEntitySummary(modelEquipment, locale))).toBe('refinement.modelTypeII')
  }
})

it('leaves the model badge off items without a tier suffix and off non-equipment entities', () => {
  const plain: WikiEquipmentSummary = { ...modelEquipment, name: localized('长息蓄电核') }

  expect(getWikiEquipmentModelKey(plain)).toBeUndefined()
  expect(getWikiEquipmentModelKey(localizeWikiEntitySummary(plain, 'en'))).toBeUndefined()
  expect(getWikiEquipmentModelKey(character('chr', '干员', 6))).toBeUndefined()
})
