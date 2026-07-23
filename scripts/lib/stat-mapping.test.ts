import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { buildGemTableLookup } from './stat-mapping'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

it('maps weapon skill tags with lossless text IDs', () => {
  const root = mkdtempSync(join(tmpdir(), 'cep-gem-lookup-'))
  roots.push(root)
  const tableDir = join(root, 'TableCfg')
  mkdirSync(tableDir, { recursive: true })

  writeFileSync(join(tableDir, 'GemTable.json'), `{
    "gst_passive_force": {
      "gemTermId": "gst_passive_force",
      "tagId": "force",
      "tagName": { "id": -8397593802376932154, "text": "" }
    }
  }`)
  writeFileSync(join(tableDir, 'I18nTextTable_CN.json'), JSON.stringify({
    '-8397593802376932154': '强攻',
  }))

  expect(buildGemTableLookup(root)).toEqual({
    cnToGem: { 强攻: 'gst_passive_force' },
    gemToCn: { gst_passive_force: '强攻' },
    gemToTextId: { gst_passive_force: '-8397593802376932154' },
    tagToGem: { force: 'gst_passive_force' },
  })
})
