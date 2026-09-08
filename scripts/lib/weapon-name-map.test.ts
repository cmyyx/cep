import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { buildWeaponNameMap } from './weapon-name-map'

const tempRoots: string[] = []

function fixtureRoot(): string {
  const root = join(process.cwd(), '.tmp-weapon-name-map-test')
  rmSync(root, { recursive: true, force: true })
  mkdirSync(join(root, 'TableCfg'), { recursive: true })
  tempRoots.push(root)
  return root
}

function writeTable(root: string, name: string, value: unknown): void {
  writeFileSync(join(root, 'TableCfg', `${name}.json`), `${JSON.stringify(value)}\n`, 'utf8')
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

it('maps unique weapon titles to their ids', () => {
  const root = fixtureRoot()
  writeTable(root, 'WeaponBasicTable', { wpn_a: {}, wpn_b: {} })
  writeTable(root, 'ItemTable', {
    wpn_a: { name: { id: 1 } },
    wpn_b: { name: { id: 2 } },
  })
  writeTable(root, 'I18nTextTable_CN', { 1: '独一份', 2: '另一把' })

  const { nameMap, ambiguousNames } = buildWeaponNameMap(root)
  expect(nameMap.get('独一份')).toBe('wpn_a')
  expect(nameMap.get('另一把')).toBe('wpn_b')
  expect(ambiguousNames.size).toBe(0)
})

it('drops duplicated titles into ambiguousNames', () => {
  const root = fixtureRoot()
  writeTable(root, 'WeaponBasicTable', { wpn_a: {}, wpn_b: {} })
  writeTable(root, 'ItemTable', {
    wpn_a: { name: { id: 1 } },
    wpn_b: { name: { id: 2 } },
  })
  writeTable(root, 'I18nTextTable_CN', { 1: '重名', 2: '重名' })

  const { nameMap, ambiguousNames } = buildWeaponNameMap(root)
  expect(nameMap.has('重名')).toBe(false)
  expect([...ambiguousNames]).toEqual(['重名'])
})

it('keeps a triple-duplicate title ambiguous instead of re-adding the third entry', () => {
  const root = fixtureRoot()
  writeTable(root, 'WeaponBasicTable', { wpn_a: {}, wpn_b: {}, wpn_c: {} })
  writeTable(root, 'ItemTable', {
    wpn_a: { name: { id: 1 } },
    wpn_b: { name: { id: 2 } },
    wpn_c: { name: { id: 3 } },
  })
  writeTable(root, 'I18nTextTable_CN', { 1: '三重名', 2: '三重名', 3: '三重名' })

  // Regression: without the ambiguousNames guard, the third entry would hit
  // `existing === weaponId === false` after the map delete and re-add itself.
  const { nameMap, ambiguousNames } = buildWeaponNameMap(root)
  expect(nameMap.has('三重名')).toBe(false)
  expect([...ambiguousNames]).toEqual(['三重名'])
})

it('returns empty results when the basic table is missing', () => {
  const root = fixtureRoot()
  const { nameMap, ambiguousNames } = buildWeaponNameMap(root)
  expect(nameMap.size).toBe(0)
  expect(ambiguousNames.size).toBe(0)
})
