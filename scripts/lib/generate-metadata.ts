// Generates metadata i18n: equip types, materials, and equip suit names.
// Suit names are auto-detected from AKEDatabase/public/CH/equip/ JSON files.
// Materials use full game names (not abbreviations).
// ================================================================================

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSuitName } from './upstream'

const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const
const TEXTTABLE_SUFFIX: Record<string, string> = { 'zh-CN': 'CN', 'zh-TW': 'TC', 'en': 'EN', 'ja': 'JP' }

// Equip types: Chinese display name -> i18n key
const EQUIP_TYPE_TERMS: { key: string; cnSearch: string }[] = [
  { key: 'body', cnSearch: '护甲' },
  { key: 'hand', cnSearch: '护手' },
  { key: 'edc', cnSearch: '配件' },
]

// Materials: full game names (key matches equip data material field)
const MATERIAL_TERMS: { key: string; cnSearch: string }[] = [
  { key: '息壤装备原件', cnSearch: '息壤装备原件' },
  { key: '赤铜装备原件', cnSearch: '赤铜装备原件' },
  { key: '赫铜装备原件', cnSearch: '赫铜装备原件' },
]

function findTextId(cnTable: Record<string, string>, searchTerm: string): string {
  for (const [textId, text] of Object.entries(cnTable)) {
    if (text === searchTerm) return textId
  }
  return ''
}

function buildI18nFiles(
  terms: { key: string; cnSearch: string }[],
  textTables: Record<string, Record<string, string>>,
  outputDir: string,
  category: string,
): number {
  const cnTable = textTables['zh-CN'] ?? {}
  const data: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) data[loc] = {}

  for (const { key, cnSearch } of terms) {
    const textId = findTextId(cnTable, cnSearch)
    for (const loc of SUPPORTED_LOCALES) {
      if (textId) {
        data[loc][key] = String(textTables[loc]?.[textId] ?? cnSearch)
      } else {
        data[loc][key] = cnSearch
      }
    }
  }

  const outDir = join(outputDir, category)
  mkdirSync(outDir, { recursive: true })
  for (const loc of SUPPORTED_LOCALES) {
    writeFileSync(join(outDir, `${loc}.json`), JSON.stringify(data[loc], null, 2) + '\n', 'utf-8')
  }
  return terms.length
}

/** Auto-detect suit names from v2_equip (primary) with old-format fallback. */
function detectSuitNames(imagedbPath: string): string[] {
  const v2Dir = join(imagedbPath, 'public', 'CH', 'v2_equip')
  const dir = existsSync(v2Dir) ? v2Dir : null
  if (!dir) return []

  const names = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
      // Only include suits that have >=5-star equipment
      const equiptable = data.equiptable as Record<string, unknown> | undefined
      const itemtable = data.itemtable as Record<string, { rarity?: number }> | undefined
      if (!equiptable || !itemtable) continue
      const has5Star = Object.entries(itemtable).some(
        ([id, item]) => equiptable[id] && (item.rarity ?? 0) >= 5,
      )
      if (!has5Star) continue
      const suitName = resolveSuitName(file, imagedbPath)
      if (suitName) names.add(suitName)
    } catch { /* skip malformed files */ }
  }
  return [...names].sort()
}

export function generateMetadataI18n(
  translationPath: string,
  outputDir: string,
  imagedbPath: string,
): { files: number; terms: number } {
  const textTables: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) {
    const suffix = TEXTTABLE_SUFFIX[loc]
    try {
      textTables[loc] = JSON.parse(readFileSync(join(translationPath, 'i18n', `I18nTextTable_${suffix}.json`), 'utf-8'))
    } catch { textTables[loc] = {} }
  }

  let totalTerms = 0

  // Equipment types
  totalTerms += buildI18nFiles(EQUIP_TYPE_TERMS, textTables, outputDir, 'equipTypes')

  // Materials (full game names, no abbreviation mapping needed)
  totalTerms += buildI18nFiles(MATERIAL_TERMS, textTables, outputDir, 'materials')

  // Suit names (auto-detected from equip JSON files)
  const suitNames = detectSuitNames(imagedbPath)
  if (suitNames.length > 0) {
    // Filter out test/manual-edit entries, sanitize keys
    const validNames = suitNames.filter(n => !n.includes('手动编辑') && !n.includes('手动'))
    const suitTerms = validNames.map(name => ({ key: name.replace(/\./g, ''), cnSearch: name }))
    totalTerms += buildI18nFiles(suitTerms, textTables, outputDir, 'suits')
  }

  // Compute actual file count: equipTypes + materials + suits(optional) × locales
  const categoryCount = 2 + (suitNames.length > 0 ? 1 : 0)
  return { files: categoryCount * SUPPORTED_LOCALES.length, terms: totalTerms }
}
