// Generates region i18n from upstream TextTable data.
// Extracts region names from WorldEnergyPointTable level-1 gameName entries
// and resolves them in all supported locales.
// Uses raw regex extraction to preserve int64 text ID precision.
// ================================================================================

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractEnergyPointLevel1Names, extractEnergyPointGroupNames } from './extract-textid'

const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const
const TEXTTABLE_SUFFIX: Record<string, string> = { 'zh-CN': 'CN', 'zh-TW': 'TC', 'en': 'EN', 'ja': 'JP' }

/**
 * Generate region i18n files from upstream energy point data.
 *
 * Strategy:
 * 1. Extract level-1 gameName text IDs from WorldEnergyPointTable
 * 2. Look up each gameName in all locale TextTables
 * 3. Split names by "·" / ":" into region and sub-region parts
 * 4. Also generate region-only entries from WorldEnergyPointGroupTable gameGroupName
 */
export function generateRegionI18n(
  akedataPath: string,
  translationPath: string,
  outputDir: string,
): string[] {
  // Load TextTable for all locales
  const textTables: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) {
    const suffix = TEXTTABLE_SUFFIX[loc]
    try {
      textTables[loc] = JSON.parse(readFileSync(join(translationPath, 'i18n', `I18nTextTable_${suffix}.json`), 'utf-8'))
    } catch { textTables[loc] = {} }
  }

  // Extract text IDs from raw JSON (preserves int64 precision)
  const levelTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointTable.json')
  const groupTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointGroupTable.json')

  const level1Names = extractEnergyPointLevel1Names(levelTablePath)
  const groupNames = extractEnergyPointGroupNames(groupTablePath)

  // Collect all dungeon names (from level 1 entries) in each locale
  const regionData: Record<string, Record<string, string>> = {}

  // Collect unique region/sub-region components
  const regionParts = new Set<string>()  // "Energy Alluvium", "The Hub", etc. (from CN)

  for (const [, info] of Object.entries(level1Names)) {
    const cnName = textTables['zh-CN']?.[info.nameTextId]
    if (!cnName) continue

    // Split "Energy Alluvium: The Hub" into ["Energy Alluvium", "The Hub"]
    const parts = String(cnName).split(/[:\uff1a\u00b7//]/).map(p => p.trim()).filter(Boolean)
    for (const part of parts) regionParts.add(part)
  }

  // Also add group names
  for (const [, info] of Object.entries(groupNames)) {
    const cnName = textTables['zh-CN']?.[info.nameTextId]
    if (cnName) regionParts.add(String(cnName).trim())
  }

  // Build region i18n: key = simplified CN name (lowercase, no spaces),
  // value = locale-specific text
  for (const loc of SUPPORTED_LOCALES) regionData[loc] = {}

  for (const cnPart of regionParts) {
    // Generate a stable key from the CN name
    const key = cnPart
      .replace(/[^\w\u4e00-\u9fff]/g, '')
      .toLowerCase()
      .slice(0, 40)

    // Find the text ID for this CN part by scanning CN TextTable
    let partTextId = ''
    for (const [textId, text] of Object.entries(textTables['zh-CN'] ?? {})) {
      if (text === cnPart) { partTextId = textId; break }
    }

    for (const loc of SUPPORTED_LOCALES) {
      if (partTextId) {
        const locText = textTables[loc]?.[partTextId]
        regionData[loc][key] = locText ? String(locText) : cnPart
      } else {
        regionData[loc][key] = cnPart
      }
    }
  }

  const outDir = join(outputDir, 'regions')
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(outDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(regionData[loc], null, 2) + '\n', 'utf-8')
    written.push(path)
  }

  return written
}
