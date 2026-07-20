import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { validateEquips } from './validate-data'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
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
