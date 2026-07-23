import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { generateWeaponStatsI18n } from './generate-weapon-stats-i18n'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

it('fails instead of generating incomplete i18n for unknown weapon skills', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-weapon-stats-i18n-'))
  roots.push(root)
  const tableDir = join(root, 'TableCfg')
  mkdirSync(tableDir, { recursive: true })

  writeFileSync(join(tableDir, 'WeaponBasicTable.json'), JSON.stringify({
    wpn_test: { rarity: 3, weaponSkillList: ['future_weapon_skill'] },
  }))
  writeFileSync(join(tableDir, 'SkillPatchTable.json'), '{}')

  expect(() => generateWeaponStatsI18n(root, join(root, 'output'))).toThrow(
    'Unable to resolve upstream weapon skills for wpn_test: future_weapon_skill',
  )
})

it('skips sub-three-star weapons without resolving their skills', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-weapon-stats-i18n-skip-'))
  roots.push(root)
  const tableDir = join(root, 'TableCfg')
  mkdirSync(tableDir, { recursive: true })

  writeFileSync(join(tableDir, 'WeaponBasicTable.json'), JSON.stringify({
    wpn_low: { rarity: 2, weaponSkillList: ['future_weapon_skill'] },
    wpn_ok: { rarity: 3, weaponSkillList: ['wpn_attr_main_low'] },
  }))
  writeFileSync(join(tableDir, 'SkillPatchTable.json'), JSON.stringify({
    wpn_attr_main_low: {
      SkillPatchDataBundle: [{ skillId: 'wpn_attr_main_low', skillName: { id: 1, text: '' }, blackboard: [{ key: 'mainattr', value: 10 }], tagId: 'attr_main' }],
    },
  }))
  writeFileSync(join(tableDir, 'GemTable.json'), JSON.stringify({
    gat_passive_attr_main: { gemTermId: 'gat_passive_attr_main', tagId: 'attr_main', tagName: { id: 11, text: '' } },
  }))
  writeFileSync(join(tableDir, 'I18nTextTable_CN.json'), JSON.stringify({ 11: '主能力提升' }))
  writeFileSync(join(tableDir, 'I18nTextTable_EN.json'), JSON.stringify({ 11: 'Main Attribute' }))
  writeFileSync(join(tableDir, 'I18nTextTable_JP.json'), JSON.stringify({ 11: 'メイン能力' }))
  writeFileSync(join(tableDir, 'I18nTextTable_TC.json'), JSON.stringify({ 11: '主能力提升' }))

  const result = generateWeaponStatsI18n(root, join(root, 'output'))
  expect(result.count).toBe(1)
  expect(result.written).toHaveLength(4)
})
