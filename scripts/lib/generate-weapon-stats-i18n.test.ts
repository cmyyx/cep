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
    wpn_test: { weaponSkillList: ['future_weapon_skill'] },
  }))
  writeFileSync(join(tableDir, 'SkillPatchTable.json'), '{}')

  expect(() => generateWeaponStatsI18n(root, join(root, 'output'))).toThrow(
    'Unable to resolve upstream weapon skills for wpn_test: future_weapon_skill',
  )
})
