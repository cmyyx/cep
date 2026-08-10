import { expect, it } from 'vitest'
import {
  defaultExpandedWikiGroups,
  filterValue,
  getWikiEntityUpStatus,
  getWikiEquipmentModelKey,
  groupWikiEntities,
  groupWikiEquipmentBySuit,
  isWikiGroupExpanded,
  matchesWikiSearchTerm,
  sortWikiEntities,
  toggleWikiGroupKey,
  wikiEntityMetaLabel,
  WIKI_GROUP_HEADER_CLASS,
  WIKI_ID_SEARCH_MIN_LENGTH,
  WIKI_NO_SET_KEY,
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

it('puts independent equipment last and sorts sets and members by rarity', () => {
  const entities: WikiEquipmentSummary[] = [
    { ...({} as WikiEquipmentSummary), id: 'a-low', category: 'equipment', name: localized('A Low'), rarity: 3, imageId: 'a-low', partTypeId: '0', minimumLevel: 20, suitId: 'suit-a', suitName: localized('套装甲') },
    { ...({} as WikiEquipmentSummary), id: 'a-high', category: 'equipment', name: localized('A High'), rarity: 5, imageId: 'a-high', partTypeId: '2', minimumLevel: 20, suitId: 'suit-a', suitName: localized('套装甲') },
    { ...({} as WikiEquipmentSummary), id: 'b', category: 'equipment', name: localized('B'), rarity: 6, imageId: 'b', partTypeId: '1', minimumLevel: 80, suitId: 'suit-b', suitName: localized('套装乙') },
    { ...({} as WikiEquipmentSummary), id: 'independent', category: 'equipment', name: localized('独立'), rarity: 1, imageId: 'independent', partTypeId: '1', minimumLevel: 10 },
  ]

  expect(groupWikiEquipmentBySuit(entities, 'zh-CN', '独立装备')).toEqual([
    { key: 'suit-b', label: '套装乙', entities: [entities[2]] },
    { key: 'suit-a', label: '套装甲', entities: [entities[1], entities[0]] },
    { key: WIKI_NO_SET_KEY, label: '独立装备', entities: [entities[3]] },
  ])
})

it('opens the leading real suits on a first visit and never the no-set bucket', () => {
  const groups = [{ key: 'suit-b' }, { key: 'suit-a' }, { key: 'suit-c' }, { key: WIKI_NO_SET_KEY }]

  expect(defaultExpandedWikiGroups(groups)).toEqual(['suit-b', 'suit-a'])
  expect(defaultExpandedWikiGroups(groups, 1)).toEqual(['suit-b'])
  expect(defaultExpandedWikiGroups([{ key: WIKI_NO_SET_KEY }])).toEqual([])
  expect(defaultExpandedWikiGroups([])).toEqual([])
})

it('toggles a group key against the effective list without mutating it', () => {
  const keys = ['suit-a', 'suit-b']

  expect(toggleWikiGroupKey(keys, 'suit-c')).toEqual(['suit-a', 'suit-b', 'suit-c'])
  expect(toggleWikiGroupKey(keys, 'suit-a')).toEqual(['suit-b'])
  expect(keys).toEqual(['suit-a', 'suit-b'])
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

const idSearchEquipment: WikiEquipmentSummary = {
  id: 'item_equip_t0_parts_tundra01_body_01',
  category: 'equipment',
  name: localized('苔原护甲', 'Tundra Armor'),
  rarity: 4,
  imageId: 'item_equip_t0_parts_tundra01_body_01',
  partTypeId: '0',
  minimumLevel: 40,
}

it('ignores the id fallback for short terms so one keystroke cannot match every entry', () => {
  expect(WIKI_ID_SEARCH_MIN_LENGTH).toBe(3)

  // Fragments that appear in every generated equipment id but not in the display name.
  for (const term of ['p', 'e', '0', 'it']) {
    expect(matchesWikiSearchTerm(idSearchEquipment, 'Tundra Armor', term, 'en')).toBe(false)
  }
  // Three characters or more is a deliberate id query.
  expect(matchesWikiSearchTerm(idSearchEquipment, 'Tundra Armor', 'tundra01', 'en')).toBe(true)
  expect(matchesWikiSearchTerm(idSearchEquipment, 'Tundra Armor', 'equip', 'en')).toBe(true)
})

it('always matches on the display name, case-insensitively, and on an empty term', () => {
  expect(matchesWikiSearchTerm(idSearchEquipment, 'Tundra Armor', '', 'en')).toBe(true)
  expect(matchesWikiSearchTerm(idSearchEquipment, 'Tundra Armor', 'tu', 'en')).toBe(true)
  expect(matchesWikiSearchTerm(idSearchEquipment, '苔原护甲', '护甲', 'zh-CN')).toBe(true)
  expect(matchesWikiSearchTerm(idSearchEquipment, 'Tundra Armor', 'zzz', 'en')).toBe(false)
})

it('builds a secondary attribute line per category and drops unresolved numeric ids', () => {
  const labels: Record<string, Record<string, string>> = {
    professions: { '0': '术师' },
    elements: { Physical: '物理' },
    weaponTypes: { '1': '单手剑' },
    equipmentParts: { '0': '护甲' },
  }
  const labelFor = (group: string, id: string) => labels[group]?.[id] ?? id

  expect(wikiEntityMetaLabel(character('chr', '干员', 6), labelFor)).toBe('术师 · 物理')
  expect(wikiEntityMetaLabel({ ...idSearchEquipment }, labelFor)).toBe('护甲')
  expect(
    wikiEntityMetaLabel(
      { id: 'wpn', category: 'weapons', name: localized('剑'), rarity: 6, imageId: 'wpn', weaponTypeId: '1', maxLevel: 90 },
      labelFor,
    ),
  ).toBe('单手剑')

  // Catalog miss: labelFor echoes the raw numeric id, which must never be shown.
  const rawLabelFor = (_group: string, id: string) => id
  expect(wikiEntityMetaLabel(character('chr', '干员', 6), rawLabelFor)).toBe('Physical')
  expect(wikiEntityMetaLabel({ ...idSearchEquipment }, rawLabelFor)).toBe('')
})

it('renders the sticky group header inside the scroll container, opaque and above the rarity band', () => {
  // Header stays within the scroll container's padding (no full-bleed negative
  // margins): negative margins made the strip overflow into a long mystery
  // bar on mid-width viewports. It must NOT contain the bleed classes.
  for (const token of ['-mx-4', 'sm:-mx-6', 'lg:-mx-8']) {
    expect(WIKI_GROUP_HEADER_CLASS.split(' ')).not.toContain(token)
  }
  expect(WIKI_GROUP_HEADER_CLASS).toContain('sticky')
  expect(WIKI_GROUP_HEADER_CLASS).toContain('top-0')
  // Opaque bg-card so the header reads as a layer on the light canvas (the old
  // bg-background/80 was the canvas itself and disappeared in light mode).
  expect(WIKI_GROUP_HEADER_CLASS).toContain('bg-card')
  expect(WIKI_GROUP_HEADER_CLASS).not.toContain('bg-background/80')
  // z-30 strictly above the in-card rarity band (z-20) so the band never
  // shows through the header when cards scroll under it.
  expect(WIKI_GROUP_HEADER_CLASS).toContain('z-30')
  // var(--border) flips with .dark so the hairline survives in dark mode.
  expect(WIKI_GROUP_HEADER_CLASS).toContain('shadow-[0_1px_0_0_var(--border)]')
})

it('resolves refinement sub-attribute filters for equipment only', () => {
  // 5★ 装备: 属性 key 来自 equipSubAttrsById。
  const fiveStar: WikiEquipmentSummary = {
    ...({} as WikiEquipmentSummary),
    id: 'item_equip_t4_suit_atk02_edc_05',
    category: 'equipment',
    name: localized('50式应龙短刃·壹型', 'Type 50 Yinglung Knife T1'),
    rarity: 5,
    imageId: 'item_equip_t4_suit_atk02_edc_05',
    partTypeId: '2',
    minimumLevel: 70,
  }
  expect(filterValue(fiveStar, 'sub1')).toBe('41')
  expect(filterValue(fiveStar, 'sub2')).toBe('39')
  expect(filterValue(fiveStar, 'special')).toBe('AllSkillDamageIncrease')

  // 非 5★ (无精锻数据) 与非装备实体返回空串, 不参与属性筛选。
  expect(filterValue(idSearchEquipment, 'sub1')).toBe('')
  const weapon = { id: 'wpn', category: 'weapons' as const, name: localized('剑', 'Sword'), rarity: 6, imageId: 'wpn', weaponTypeId: '1', maxLevel: 90 }
  expect(filterValue(weapon, 'sub1')).toBe('')
})

it('resolves the rarity filter from the entity rarity for every category', () => {
  expect(filterValue({ ...idSearchEquipment, rarity: 4 }, 'rarity')).toBe('4')
  const weapon = { id: 'wpn', category: 'weapons' as const, name: localized('剑', 'Sword'), rarity: 6, imageId: 'wpn', weaponTypeId: '1', maxLevel: 90 }
  expect(filterValue(weapon, 'rarity')).toBe('6')
  const char = { ...character('chr', '干员', 6) }
  expect(filterValue(char, 'rarity')).toBe('6')
})
