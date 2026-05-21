// Generates metadata i18n: equip types, materials (with abbreviation->full name mapping),
// and equip suit names. All sourced from AKEData TextTable.
// ================================================================================

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const
const TEXTTABLE_SUFFIX: Record<string, string> = { 'zh-CN': 'CN', 'zh-TW': 'TC', 'en': 'EN', 'ja': 'JP' }

// Equip types: Chinese display name -> i18n key
const EQUIP_TYPE_TERMS: { key: string; cnSearch: string }[] = [
  { key: 'body', cnSearch: '护甲' },
  { key: 'hand', cnSearch: '护手' },
  { key: 'edc', cnSearch: '配件' },
]

// Materials: abbreviation used in equips.ts -> full game name for TextTable lookup
const MATERIAL_TERMS: { key: string; cnSearch: string }[] = [
  { key: '息壤', cnSearch: '息壤装备原件' },
  { key: '赤铜', cnSearch: '赤铜装备原件' },
  { key: '赫铜', cnSearch: '赫铜装备原件' },
]

// Equip suit names: Chinese name (as displayed in UI) for TextTable lookup
const SUIT_NAMES: string[] = [
  '拓荒', '潮涌', '长息', '碾骨', '脉冲式', '生物辅助',
  '动火用', '点剑', '轻超域', '独立装备', '壤流',
  // These may need different search terms for TextTable matching
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

export function generateMetadataI18n(
  translationPath: string,
  outputDir: string,
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

  // Materials (with abbreviation->full name mapping)
  totalTerms += buildI18nFiles(MATERIAL_TERMS, textTables, outputDir, 'materials')

  // Suit names
  const suitTerms = SUIT_NAMES.map(name => ({ key: name, cnSearch: name }))
  totalTerms += buildI18nFiles(suitTerms, textTables, outputDir, 'suits')

  return { files: 12, terms: totalTerms }
}
