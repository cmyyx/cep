// Generates metadata i18n: equip types, materials/vouchers, and equip suit names.
// Suit names are auto-detected from AKEData/TableCfg/EquipSuitTable.json.
// Materials and vouchers are auto-detected from EquipFormulaChainTable.json.
// ================================================================================

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import { loadAllTextTables, loadTextTable, SUPPORTED_LOCALES } from './stat-mapping'

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

/** Regex-based extraction of itemId→rarity for equip items from ItemTable raw text.
 *  Avoids full JSON.parse of the 110K+ line file. */
function buildEquipRarityMap(itemTablePath: string): Map<string, number> {
  const map = new Map<string, number>()
  if (!existsSync(itemTablePath)) return map
  const raw = readFileSync(itemTablePath, 'utf-8')
  const itemRe = /"(\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(raw)) !== null) {
    const itemId = m[1]
    if (!itemId.startsWith('item_equip_')) continue
    const window = raw.substring(m.index, m.index + 3000)
    const rarityMatch = window.match(/"rarity"\s*:\s*(-?\d+)/)
    if (rarityMatch?.[1]) {
      map.set(itemId, Number(rarityMatch[1]))
    }
  }
  return map
}

/** Auto-detect suit names from EquipSuitTable, filtering to ≥5★ suits. */
function detectSuitNames(akedataPath: string): string[] {
  const suitTablePath = join(akedataPath, 'TableCfg', 'EquipSuitTable.json')
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  if (!existsSync(suitTablePath) || !existsSync(itemTablePath)) return []

  const suitTable = parseJsonSafe(suitTablePath) as Record<string, {
    equipList?: string[]
    list?: { suitName?: { id: string } }[]
  }>
  const equipRarity = buildEquipRarityMap(itemTablePath)
  const textTable = loadTextTable(akedataPath, 'zh-CN')
  const names = new Set<string>()

  for (const [, suit] of Object.entries(suitTable)) {
    const suitNameId = suit.list?.[0]?.suitName?.id
    if (!suitNameId) continue
    const suitName = textTable[String(suitNameId)]
    if (!suitName) continue

    const has5Star = (suit.equipList ?? []).some(eid => (equipRarity.get(eid) ?? 0) >= 5)
    if (has5Star) names.add(suitName)
  }

  return [...names].sort()
}

/** Regex-based extraction of itemId→CN name for all items from ItemTable+TextTable. */
function buildItemCnNameMap(itemTablePath: string, textTable: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(itemTablePath)) return map
  const raw = readFileSync(itemTablePath, 'utf-8')
  const itemRe = /"(\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(raw)) !== null) {
    const itemId = m[1]
    if (!itemId.startsWith('item_')) continue
    const window = raw.substring(m.index, m.index + 3000)
    const nameMatch = window.match(/"name"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)
    if (nameMatch?.[1]) {
      const cn = textTable[nameMatch[1]]
      if (cn) map.set(itemId, cn)
    }
  }
  return map
}

/** Auto-detect material and voucher names from EquipFormulaChainTable. */
function detectMaterialAndVoucherNames(akedataPath: string): string[] {
  const chainTablePath = join(akedataPath, 'TableCfg', 'EquipFormulaChainTable.json')
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  if (!existsSync(chainTablePath) || !existsSync(itemTablePath)) return []

  const chainTable = JSON.parse(readFileSync(chainTablePath, 'utf-8')) as Record<string, {
    chainList?: { costItemId?: string[]; costGoldId?: string }[]
  }>
  const textTable = loadTextTable(akedataPath, 'zh-CN')
  const itemNameMap = buildItemCnNameMap(itemTablePath, textTable)
  const names = new Set<string>()

  for (const [, tier] of Object.entries(chainTable)) {
    for (const chain of tier.chainList ?? []) {
      for (const costId of chain.costItemId ?? []) {
        const name = itemNameMap.get(costId)
        if (name) names.add(name)
      }
      if (chain.costGoldId) {
        const name = itemNameMap.get(chain.costGoldId)
        if (name) names.add(name)
      }
    }
  }

  return [...names].sort()
}
export function generateMetadataI18n(
  akedataPath: string,
  outputDir: string,
): { files: number; terms: number } {
  // Load TextTable for all locales (from AKEData/TableCfg)
  const textTables = loadAllTextTables(akedataPath)

  let totalTerms = 0

  // Equipment types
  totalTerms += buildI18nFiles(EQUIP_TYPE_TERMS, textTables, outputDir, 'equipTypes')

  // Materials & vouchers (auto-detected from EquipFormulaChainTable)
  const materialAndVoucherNames = detectMaterialAndVoucherNames(akedataPath)
  const materialTerms = materialAndVoucherNames.map(name => ({ key: name, cnSearch: name }))
  totalTerms += buildI18nFiles(materialTerms, textTables, outputDir, 'materials')

  // Suit names (auto-detected from EquipSuitTable)
  const suitNames = detectSuitNames(akedataPath)
  // Always include standalone equipment
  if (!suitNames.includes('独立装备')) suitNames.push('独立装备')
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
