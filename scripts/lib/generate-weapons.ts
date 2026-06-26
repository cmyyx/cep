// Generates weapon i18n from AKEDatabase/public/CH (primary) + AKEData (fallback).
// CN uses weapon title JSON; EN/JP/TC use ItemTable.name.id -> TextTable lookup.
// Filters to 4-star and above weapons.
// ================================================================================

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'
import { loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'

export function generateWeaponI18n(
  akedataPath: string,
  imagedbPath: string,
  outputDir: string,
): { written: string[]; count: number; missing: number } {
  // Primary source: AKEDatabase/public/CH/weapon/ (always most up-to-date)
  // Fallback: AKEData/output/CN/weapon/
  const primaryDir = join(imagedbPath, 'public', 'CH', 'weapon')
  const fallbackDir = join(akedataPath, 'output', 'CN', 'weapon')
  const weaponDir = existsSync(primaryDir) ? primaryDir
    : existsSync(fallbackDir) ? fallbackDir
    : null

  if (!weaponDir) return { written: [], count: 0, missing: 0 }

  // Load TextTable for all locales (from AKEData/TableCfg)
  const textTables = loadAllTextTables(akedataPath)

  // Extract localized name text IDs from ItemTable.json
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  const nameTextIdMap = extractItemNameIds(itemTablePath)

  // Read WeaponBasicTable for rarity filtering
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  const rarityMap: Record<string, number> = {}
  if (existsSync(wpnBasicPath)) {
    const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, Record<string, unknown>>
    for (const [wpnId, data] of Object.entries(wpnBasic)) {
      rarityMap[wpnId] = (data.rarity as number) ?? 1
    }
  }

  const i18nData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) i18nData[loc] = {}

  let count = 0
  let missing = 0

  for (const file of readdirSync(weaponDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const weaponId = file.replace('.json', '')

    // Filter: 4-star and above only
    const rarity = rarityMap[weaponId] ?? 1
    if (rarity < 4) continue

    const data = JSON.parse(readFileSync(join(weaponDir, file), 'utf-8'))
    const cnTitle = String(data.title ?? weaponId).replace(/\n/g, ' ').trim()
    const nameTextId = nameTextIdMap[weaponId]

    for (const loc of SUPPORTED_LOCALES) {
      if (loc === 'zh-CN') {
        i18nData[loc][weaponId] = cnTitle
      } else {
        let text = ''
        if (nameTextId) {
          text = textTables[loc]?.[nameTextId] ?? ''
        }
        if (!text) {
          text = textTables['zh-CN']?.[nameTextId] ?? cnTitle
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
