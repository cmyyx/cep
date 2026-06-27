// Generates metadata i18n: equip types, materials/vouchers, and equip suit names.
// Suit names are auto-detected from AKEDatabase/public/CH/equip/ JSON files.
// Materials and vouchers are auto-detected from equipformulatable in v2_equip.
// ================================================================================

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSuitName } from './upstream'
import { loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'

// Equip types: Chinese display name -> i18n key
const EQUIP_TYPE_TERMS: { key: string; cnSearch: string }[] = [
  { key: 'body', cnSearch: '护甲' },
  { key: 'hand', cnSearch: '护手' },
  { key: 'edc', cnSearch: '配件' },
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
  const equipDir = join(imagedbPath, 'public', 'CH', 'equip')
  const dir = existsSync(v2Dir) ? v2Dir : existsSync(equipDir) ? equipDir : null
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

/** Auto-detect material and voucher names from v2_equip equipformulatable. */
function detectMaterialAndVoucherNames(imagedbPath: string): string[] {
  const v2Dir = join(imagedbPath, 'public', 'CH', 'v2_equip')
  if (!existsSync(v2Dir)) return []

  const names = new Set<string>()
  for (const file of readdirSync(v2Dir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    try {
      const data = JSON.parse(readFileSync(join(v2Dir, file), 'utf-8'))
      const equiptable = data.equiptable as Record<string, unknown> | undefined
      const itemtable = data.itemtable as Record<string, { name?: { text: string }; rarity?: number }> | undefined
      const equipformulatable = data.equipformulatable as Record<string, {
        costItemId?: string[]
        costGoldId?: string
        outcomeEquipId?: string
      }> | undefined
      if (!equiptable || !itemtable || !equipformulatable) continue

      for (const formula of Object.values(equipformulatable)) {
        if (!formula.outcomeEquipId) continue
        // Only process formulas for >=5-star equipment
        const outItem = itemtable[formula.outcomeEquipId]
        if (!outItem || (outItem.rarity ?? 0) < 5) continue
        // Material names from costItemId
        for (const costId of formula.costItemId ?? []) {
          const costItem = itemtable[costId]
          if (costItem?.name?.text) names.add(costItem.name.text)
        }
        // Voucher name from costGoldId
        if (formula.costGoldId) {
          const goldItem = itemtable[formula.costGoldId]
          if (goldItem?.name?.text) names.add(goldItem.name.text)
        }
      }
    } catch { /* skip malformed files */ }
  }
  return [...names].sort()
}

export function generateMetadataI18n(
  akedataPath: string,
  outputDir: string,
  imagedbPath: string,
): { files: number; terms: number } {
  // Load TextTable for all locales (from AKEData/TableCfg)
  const textTables = loadAllTextTables(akedataPath)

  let totalTerms = 0

  // Equipment types
  totalTerms += buildI18nFiles(EQUIP_TYPE_TERMS, textTables, outputDir, 'equipTypes')

  // Materials & vouchers (auto-detected from v2_equip equipformulatable)
  const materialAndVoucherNames = detectMaterialAndVoucherNames(imagedbPath)
  if (materialAndVoucherNames.length > 0) {
    const materialTerms = materialAndVoucherNames.map(name => ({ key: name, cnSearch: name }))
    totalTerms += buildI18nFiles(materialTerms, textTables, outputDir, 'materials')
  }

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
