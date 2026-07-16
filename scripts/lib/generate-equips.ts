// Generates equip i18n from AKEData/TableCfg (EquipTable + ItemTable).
// Only >=5star equipment. Uses ItemTable.name.id for properly localized display names.
// ================================================================================

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'
import { loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'
import { parseJsonSafe } from './json-utils'

interface ItemTableEntry {
  name?: { id?: string | number }
  rarity?: number
}

export function generateEquipI18n(
  akedataPath: string,
  outputDir: string,
): { written: string[]; count: number; missing: number } {
  const equipTablePath = join(akedataPath, 'TableCfg', 'EquipTable.json')
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')

  if (!existsSync(equipTablePath) || !existsSync(itemTablePath)) {
    return { written: [], count: 0, missing: 0 }
  }

  // Load TextTable for all locales (from AKEData/TableCfg)
  const textTables = loadAllTextTables(akedataPath)

  // Extract localized name text IDs from ItemTable.json
  const nameTextIdMap = extractItemNameIds(itemTablePath)

  // Load full ItemTable for rarity filtering
  const itemTable = parseJsonSafe(itemTablePath) as Record<string, ItemTableEntry>

  // Load EquipTable
  const equipTable = parseJsonSafe(equipTablePath) as Record<string, unknown>

  const i18nData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) i18nData[loc] = {}

  let count = 0
  let missing = 0

  for (const [itemId] of Object.entries(equipTable)) {
    const itemData = itemTable[itemId]
    if (!itemData) continue

    const rarity = Number(itemData.rarity ?? 1)
    if (rarity < 5) continue

    const nameTextId = nameTextIdMap[itemId]

    for (const loc of SUPPORTED_LOCALES) {
      if (loc === 'zh-CN') {
        // CN name from ItemTable.name.id -> CN TextTable
        const cnName = nameTextId
          ? (textTables['zh-CN']?.[nameTextId] ?? itemId)
          : itemId
        i18nData[loc][itemId] = String(cnName).replace(/\n/g, ' ').trim()
      } else {
        let text = ''
        if (nameTextId) {
          text = textTables[loc]?.[nameTextId] ?? ''
        }
        if (!text) {
          text = textTables['zh-CN']?.[nameTextId] ?? itemId
          if (!nameTextId || !(textTables[loc]?.[nameTextId])) missing++
        }
        i18nData[loc][itemId] = text.replace(/\n/g, ' ').trim()
      }
    }
    count++
  }

  const outDir = join(outputDir, 'equips')
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(outDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(i18nData[loc], null, 2) + '\n', 'utf-8')
    written.push(path)
  }

  return { written, count, missing }
}
