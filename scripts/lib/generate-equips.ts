// Generates equip i18n from AKEDatabase/public/CH (primary) + AKEData (fallback).
// Only >=5star equipment. Uses ItemTable.name.id for properly localized display names.
// ================================================================================

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'

const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const
const TEXTTABLE_SUFFIX: Record<string, string> = { 'zh-CN': 'CN', 'zh-TW': 'TC', 'en': 'EN', 'ja': 'JP' }

export function generateEquipI18n(
  akedataPath: string,
  imagedbPath: string,
  translationPath: string,
  outputDir: string,
): { written: string[]; count: number; missing: number } {
  // Primary source: AKEDatabase/public/CH/equip/ (always most up-to-date)
  const primaryDir = join(imagedbPath, 'public', 'CH', 'equip')
  const fallbackDir = join(akedataPath, 'output', 'CN', 'equip')
  const equipDir = existsSync(primaryDir) ? primaryDir
    : existsSync(fallbackDir) ? fallbackDir
    : null

  if (!equipDir) return { written: [], count: 0, missing: 0 }

  // Load TextTable for all locales
  const textTables: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) {
    const suffix = TEXTTABLE_SUFFIX[loc]
    try {
      textTables[loc] = JSON.parse(readFileSync(join(translationPath, 'i18n', `I18nTextTable_${suffix}.json`), 'utf-8'))
    } catch { textTables[loc] = {} }
  }

  // Extract localized name text IDs from ItemTable.json
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  const nameTextIdMap = extractItemNameIds(itemTablePath)

  const i18nData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) i18nData[loc] = {}

  let count = 0
  let missing = 0

  for (const file of readdirSync(equipDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const data = JSON.parse(readFileSync(join(equipDir, file), 'utf-8'))
    const suitName = data['套组名称'] ?? ''
    // Skip test/manual/placeholder entries
    if (/test|测试|手动|debug|placeholder/i.test(suitName)) continue
    const equip = data.equip as Record<string, unknown> | undefined
    if (!equip) continue

    for (const [itemId, itemData] of Object.entries(equip)) {
      const item = itemData as Record<string, unknown>
      if ((item.rarity as number) < 5) continue
      const cnName = String(item.name ?? itemId).replace(/\n/g, ' ').trim()
      const nameTextId = nameTextIdMap[itemId]

      for (const loc of SUPPORTED_LOCALES) {
        if (loc === 'zh-CN') {
          i18nData[loc][itemId] = cnName
        } else {
          let text = ''
          if (nameTextId) {
            text = textTables[loc]?.[nameTextId] ?? ''
          }
          if (!text) {
            text = textTables['zh-CN']?.[nameTextId] ?? cnName
            if (!nameTextId || !(textTables[loc]?.[nameTextId])) missing++
          }
          i18nData[loc][itemId] = text.replace(/\n/g, ' ').trim()
        }
      }
      count++
    }
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
