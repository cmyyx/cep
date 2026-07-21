// Generates weapon i18n from AKEData/TableCfg (WeaponBasicTable + ItemTable + I18nTextTable).
// CN uses I18nTextTable_CN via ItemTable.name.id; other locales use the same path.
// Filters to 3-star and above weapons.
// ================================================================================

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'
import { loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'

export function generateWeaponI18n(
  akedataPath: string,
  outputDir: string,
): { written: string[]; count: number; missing: number } {
  // Load WeaponBasicTable for weapon list and rarity filtering
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  if (!existsSync(wpnBasicPath)) return { written: [], count: 0, missing: 0 }

  const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, { rarity?: number }>

  // Load TextTable for all locales (from AKEData/TableCfg)
  const textTables = loadAllTextTables(akedataPath)

  // Extract localized name text IDs from ItemTable.json
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  const nameTextIdMap = extractItemNameIds(itemTablePath)

  const i18nData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) i18nData[loc] = {}

  let count = 0
  let missing = 0

  // Iterate WeaponBasicTable entries (all 76 weapons)
  for (const [weaponId, wpnData] of Object.entries(wpnBasic)) {
    // Filter: 3-star and above only
    const rarity = wpnData.rarity ?? 1
    if (rarity < 3) continue

    const nameTextId = nameTextIdMap[weaponId]

    for (const loc of SUPPORTED_LOCALES) {
      if (loc === 'zh-CN') {
        // CN: resolve from ItemTable.name.id → I18nTextTable_CN
        const cnText = nameTextId ? (textTables['zh-CN']?.[nameTextId] ?? weaponId) : weaponId
        i18nData[loc][weaponId] = String(cnText).replace(/\n/g, ' ').trim()
      } else {
        let text = ''
        if (nameTextId) {
          text = textTables[loc]?.[nameTextId] ?? ''
        }
        if (!text) {
          text = textTables['zh-CN']?.[nameTextId] ?? weaponId
          if (!nameTextId || !(textTables[loc]?.[nameTextId])) missing++
        }
        i18nData[loc][weaponId] = text.replace(/\n/g, ' ').trim()
      }
    }
    count++
  }

  const outDir = join(outputDir, 'weapons')
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(outDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(i18nData[loc], null, 2) + '\n', 'utf-8')
    written.push(path)
  }

  return { written, count, missing }
}
