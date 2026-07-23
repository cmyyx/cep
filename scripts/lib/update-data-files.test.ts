import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { updateWeaponsFile } from './update-data-files'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function createWeaponUpstream(root: string): void {
  const tableDir = join(root, 'TableCfg')
  mkdirSync(tableDir, { recursive: true })

  writeFileSync(join(tableDir, 'WeaponBasicTable.json'), JSON.stringify({
    wpn_claym_test: {
      weaponId: 'wpn_claym_test',
      rarity: 3,
      weaponType: 3,
      weaponSkillList: ['wpn_attr_main_low', 'sk_wpn_claym_test'],
    },
  }))
  writeFileSync(join(tableDir, 'SkillPatchTable.json'), JSON.stringify({
    wpn_attr_main_low: {
      SkillPatchDataBundle: [{
        skillId: 'wpn_attr_main_low',
        skillName: { id: 101, text: '' },
        blackboard: [{ key: 'mainattr', value: 1 }],
        tagId: 'attr_main',
      }],
    },
    sk_wpn_claym_test: {
      SkillPatchDataBundle: [{
        skillId: 'sk_wpn_claym_test',
        skillName: { id: 102, text: '' },
        blackboard: [{ key: 'atk_up', value: 12 }],
        tagId: 'force',
      }],
    },
  }))
  writeFileSync(join(tableDir, 'GemTable.json'), JSON.stringify({
    gat_passive_attr_main: {
      gemTermId: 'gat_passive_attr_main',
      tagId: 'attr_main',
      tagName: { id: 201, text: '' },
    },
    gst_passive_force: {
      gemTermId: 'gst_passive_force',
      tagId: 'force',
      tagName: { id: 202, text: '' },
    },
  }))
  writeFileSync(join(tableDir, 'ItemTable.json'), JSON.stringify({
    wpn_claym_test: { name: { id: 100 }, iconId: 'wpn_claym_test' },
  }))
  writeFileSync(join(tableDir, 'I18nTextTable_CN.json'), JSON.stringify({
    100: '三星测试',
    102: '强攻·武装整备',
    201: '主能力提升',
    202: '强攻',
  }))
}

it('adds a three-star weapon with no additional attribute and a retained skill attribute', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-update-weapons-'))
  roots.push(root)
  createWeaponUpstream(root)

  const weaponsPath = join(root, 'weapons.ts')
  writeFileSync(weaponsPath, [
    "import type { Weapon } from '@/types/matrix'",
    'export const weapons: Weapon[] = [',
    '  // ===== 三星（无附加属性；null 表示该槽位不限制） =====',
    ']',
    '',
  ].join('\n'))

  expect(updateWeaponsFile(weaponsPath, root)).toEqual({
    added: 1,
    updated: 0,
    unchanged: 0,
  })

  const output = readFileSync(weaponsPath, 'utf8')
  expect(output).toContain("name: '三星测试', rarity: 3, type: '双手剑'")
  expect(output).toContain("primaryStat: 'gat_passive_attr_main'")
  expect(output).toContain('elementalDamage: null')
  expect(output).toContain("specialAbility: 'gst_passive_force'")
})

it('automatically reconciles incorrect existing weapon slots without losing recommendations', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-reconcile-weapons-'))
  roots.push(root)
  createWeaponUpstream(root)

  const weaponsPath = join(root, 'weapons.ts')
  writeFileSync(weaponsPath, [
    "import type { Weapon } from '@/types/matrix'",
    'export const weapons: Weapon[] = [',
    '  // ===== 三星（无附加属性；null 表示该槽位不限制） =====',
    "  { id: 'wpn_claym_test', iconId: 'wpn_claym_test', name: '三星测试', rarity: 3, type: '双手剑', primaryStat: 'gat_passive_attr_main', elementalDamage: 'gat_passive_attr_atk', chars: ['测试干员'] },",
    ']',
    '',
  ].join('\n'))

  expect(updateWeaponsFile(weaponsPath, root)).toEqual({
    added: 0,
    updated: 1,
    unchanged: 0,
  })

  const output = readFileSync(weaponsPath, 'utf8')
  expect(output).toContain('elementalDamage: null')
  expect(output).toContain("specialAbility: 'gst_passive_force'")
  expect(output).not.toContain(',,')
  expect(output).toContain("chars: ['测试干员']")
})
