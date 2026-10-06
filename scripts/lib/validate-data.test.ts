import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { validateCharacterAvatarMappings, validateEquips, validateWeapons } from './validate-data'
import type { BannerNameSource } from './validate-data'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** Minimal project carrying the three files the avatar mapping check reads. */
function avatarMappingProject(
  characters: Record<string, string>,
  previewAvatars: Record<string, string>,
  withBannerTs = true,
): string {
  const root = mkdtempSync(join(tmpdir(), 'cep-avatar-mapping-'))
  roots.push(root)
  mkdirSync(join(root, 'src', 'data'), { recursive: true })
  mkdirSync(join(root, 'src', 'generated', 'i18n', 'characters'), { recursive: true })
  mkdirSync(join(root, 'src', 'generated', 'data', 'wiki'), { recursive: true })
  if (withBannerTs) {
    writeFileSync(join(root, 'src', 'data', 'banner.ts'), 'export const bannerSchedule = {}\n')
  }
  writeFileSync(
    join(root, 'src', 'generated', 'i18n', 'characters', 'zh-CN.json'),
    JSON.stringify(characters),
  )
  writeFileSync(
    join(root, 'src', 'generated', 'data', 'wiki', 'preview-character-avatars.json'),
    JSON.stringify(previewAvatars),
  )
  return root
}

const stubBannerData = (names: BannerNameSource) => async () => names

it('reports banner and standard characters that have no avatar mapping', async () => {
  const root = avatarMappingProject({ chr_0004_pelica: '佩丽卡', chr_0035_liino: '梨诺' }, {})

  const issues = await validateCharacterAvatarMappings(
    root,
    stubBannerData({
      bannerSchedule: { 佩丽卡: {}, 祀: {}, 明河: {} },
      standardCharacters: ['艾尔黛拉', '梨诺'],
    }),
  )

  expect(issues).toEqual([
    { name: '祀', source: 'banner' },
    { name: '明河', source: 'banner' },
    { name: '艾尔黛拉', source: 'standard' },
  ])
})

it('accepts Skland preview mappings and reports a name only once', async () => {
  const root = avatarMappingProject({ chr_0004_pelica: '佩丽卡' }, { 祀: 'preview-2201' })

  expect(
    await validateCharacterAvatarMappings(
      root,
      stubBannerData({ bannerSchedule: { 祀: {}, 明河: {} }, standardCharacters: ['祀', '明河'] }),
    ),
  ).toEqual([{ name: '明河', source: 'banner' }])
})

it('skips the check when the project has no banner data', async () => {
  const root = avatarMappingProject({ chr_0004_pelica: '佩丽卡' }, {}, false)

  expect(
    await validateCharacterAvatarMappings(
      root,
      stubBannerData({ bannerSchedule: { 祀: {} }, standardCharacters: [] }),
    ),
  ).toEqual([])
})

it('loads the real banner data through the default loader', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))

  // Emptiness is enforced by the sync check phase (which prints an actionable
  // message); this test only proves the default loader can import banner.ts.
  const issues = await validateCharacterAvatarMappings(root)
  expect(
    issues.every((issue) => issue.name.length > 0 && ['banner', 'standard'].includes(issue.source)),
  ).toBe(true)
})

it('compares equipment only after every upstream modifier has been collected', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-validate-equips-'))
  roots.push(root)
  const tableDir = join(root, 'TableCfg')
  mkdirSync(tableDir, { recursive: true })
  const writeJson = (name: string, value: unknown) => writeFileSync(join(tableDir, `${name}.json`), JSON.stringify(value))

  writeJson('EquipTable', {
    item_equip_test: {
      displayAttrModifiers: [
        { attrIndex: 1, attrType: 39, attrValue: 32, modifierType: 5 },
        { attrIndex: 2, attrType: 40, attrValue: 21, modifierType: 5 },
        { attrIndex: 3, attrType: 41, attrValue: 0.276, modifierType: 5 },
      ],
    },
  })
  writeJson('ItemTable', { item_equip_test: { name: { id: 100 } } })
  writeJson('I18nTextTable_CN', { 100: '测试装备', 139: '力量', 140: '敏捷', 141: '增伤' })
  writeJson('AttributeShowConfigTable', {
    39: { list: [{ name: { id: 139 }, attributeModifier: 5, showPercent: false, valueFormat: '{value}' }] },
    40: { list: [{ name: { id: 140 }, attributeModifier: 5, showPercent: false, valueFormat: '{value}' }] },
    41: { list: [{ name: { id: 141 }, attributeModifier: 5, showPercent: true, valueFormat: '{value:0.0%}' }] },
  })
  writeJson('CompositeAttributeShowConfigTable', {})

  const projectPath = join(root, 'equips.ts')
  writeFileSync(projectPath, `const RAW_EQUIPS = [\n  { name: '测试装备', sub1: '39+32', sub2: '40+21', special: '41+27.6%', equipId: 'item_equip_test', iconId: 'item_equip_test' },\n]\n`)

  expect(validateEquips(root, projectPath)).toEqual([])
})

it('detects the incorrect three-star slot mapping from upstream skill families', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-validate-weapons-'))
  roots.push(root)
  const tableDir = join(root, 'TableCfg')
  mkdirSync(tableDir, { recursive: true })
  const writeJson = (name: string, value: unknown) => writeFileSync(join(tableDir, `${name}.json`), JSON.stringify(value))

  writeJson('WeaponBasicTable', {
    wpn_claym_test: {
      rarity: 3,
      weaponType: 3,
      weaponSkillList: ['wpn_attr_main_low', 'sk_wpn_claym_test'],
    },
  })
  writeJson('SkillPatchTable', {
    wpn_attr_main_low: {
      SkillPatchDataBundle: [{ skillId: 'wpn_attr_main_low', skillName: { id: 1, text: '' }, blackboard: [{ key: 'mainattr', value: 10 }], tagId: 'attr_main' }],
    },
    sk_wpn_claym_test: {
      SkillPatchDataBundle: [{ skillId: 'sk_wpn_claym_test', skillName: { id: 2, text: '' }, blackboard: [{ key: 'atk_up', value: 12 }], tagId: 'force' }],
    },
  })
  writeJson('GemTable', {
    gat_passive_attr_main: { gemTermId: 'gat_passive_attr_main', tagId: 'attr_main', tagName: { id: 11, text: '' } },
    gst_passive_force: { gemTermId: 'gst_passive_force', tagId: 'force', tagName: { id: 12, text: '' } },
  })
  writeJson('ItemTable', { wpn_claym_test: { name: { id: 100 } } })
  writeJson('I18nTextTable_CN', { 2: '强攻·武装整备', 11: '主能力提升', 12: '强攻', 100: '三星测试' })

  const projectPath = join(root, 'weapons.ts')
  writeFileSync(projectPath, [
    'export const weapons = [',
    "  { id: 'wpn_claym_test', name: '三星测试', rarity: 3, type: '双手剑', primaryStat: 'gat_passive_attr_main', elementalDamage: 'gat_passive_attr_atk', specialAbility: null, chars: [] },",
    ']',
  ].join('\n'))

  expect(validateWeapons(root, projectPath)).toEqual([
    {
      category: 'weapon',
      id: 'wpn_claym_test',
      field: 'elementalDamage',
      expected: '<empty>',
      actual: 'gat_passive_attr_atk',
    },
    {
      category: 'weapon',
      id: 'wpn_claym_test',
      field: 'specialAbility',
      expected: 'gst_passive_force',
      actual: '<empty>',
    },
  ])

  writeFileSync(projectPath, 'export const weapons = []\n')
  expect(validateWeapons(root, projectPath)).toContainEqual({
    category: 'weapon',
    id: 'wpn_claym_test',
    field: 'record',
    expected: 'present',
    actual: '<missing>',
  })

  writeFileSync(projectPath, [
    'export const weapons = [',
    "  { id: 'wpn_claym_test', name: '三星测试', rarity: 3, type: '双手剑', primaryStat: 'gat_passive_attr_main', elementalDamage: null, specialAbility: 'gst_passive_force', chars: [] },",
    "  { id: 'preview:测试预告', name: '测试预告', rarity: 6, type: '双手剑', primaryStat: 'gat_passive_attr_main', elementalDamage: 'gat_passive_attr_atk', specialAbility: 'gst_passive_force', chars: [], source: 'preview' },",
    "  { id: 'wpn_unknown', name: '未知正式武器', rarity: 6, type: '双手剑', primaryStat: 'gat_passive_attr_main', elementalDamage: 'gat_passive_attr_atk', specialAbility: 'gst_passive_force', chars: [] },",
    ']',
  ].join('\n'))
  expect(validateWeapons(root, projectPath).filter((issue) => issue.field === 'record')).toEqual([
    {
      category: 'weapon',
      id: 'wpn_unknown',
      field: 'record',
      expected: '<absent>',
      actual: 'present',
    },
  ])
})
