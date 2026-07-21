import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { updateWeaponsFile } from './update-data-files'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

it('writes three-star weapons into the three-star section with a null missing slot', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-update-weapons-'))
  roots.push(root)
  const tableDir = join(root, 'TableCfg')
  mkdirSync(tableDir, { recursive: true })

  writeFileSync(join(tableDir, 'WeaponBasicTable.json'), JSON.stringify({
    wpn_claym_test: {
      weaponId: 'wpn_claym_test',
      rarity: 3,
      weaponType: 3,
      weaponSkillList: ['skill_main', 'skill_atk'],
    },
  }))
  writeFileSync(join(tableDir, 'SkillPatchTable.json'), JSON.stringify({
    skill_main: { SkillPatchDataBundle: [{ skillId: 'skill_main', skillName: { id: '0', text: '' }, blackboard: [{ key: 'mainattr', value: 1 }] }] },
    skill_atk: { SkillPatchDataBundle: [{ skillId: 'skill_atk', skillName: { id: '0', text: '' }, blackboard: [{ key: 'atk', value: 1 }] }] },
  }))
  writeFileSync(join(tableDir, 'ItemTable.json'), JSON.stringify({
    wpn_claym_test: { name: { id: 100 }, iconId: 'wpn_claym_test' },
  }))
  writeFileSync(join(tableDir, 'I18nTextTable_CN.json'), JSON.stringify({ 100: '三星测试' }))

  const weaponsPath = join(root, 'weapons.ts')
  writeFileSync(weaponsPath, [
    "import type { Weapon } from '@/types/matrix'",
    'export const weapons: Weapon[] = [',
    '  // ===== 六星 =====',
    "  { id: 'wpn_sword_old', name: '旧武器', rarity: 6, type: '单手剑', primaryStat: 'a', elementalDamage: 'b', specialAbility: 'c', chars: [] },",
    '  // ===== 三星（无第三词条；null 表示该槽位不限制） =====',
    ']',
    '',
  ].join('\n'))

  expect(updateWeaponsFile(weaponsPath, ['wpn_claym_test'], root)).toBe(1)

  const output = readFileSync(weaponsPath, 'utf8')
  const threeStarSection = output.slice(output.indexOf('// ===== 三星'))
  expect(threeStarSection).toContain("name: '三星测试', rarity: 3, type: '双手剑'")
  expect(threeStarSection).toContain("primaryStat: 'gat_passive_attr_main'")
  expect(threeStarSection).toContain("elementalDamage: 'gat_passive_attr_atk'")
  expect(threeStarSection).toContain('specialAbility: null')
  expect(output.indexOf("id: 'wpn_claym_test'")).toBeGreaterThan(output.indexOf('// ===== 三星'))
})
