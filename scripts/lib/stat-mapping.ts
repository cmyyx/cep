// Shared utilities for loading TextTables and building CN stat name → gemTermId mappings.
//
// i18n source: AKEData/TableCfg/I18nTextTable_{locale}.json (single upstream repo,
// EndFieldTranslationReferrer has been abandoned — it was a stale second-hand copy).
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'

/** Locales supported by the project. */
export const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const

/** TextTable filename suffix per locale (game uses CN/EN/JP/TC, not BCP-47). */
export const TEXTTABLE_SUFFIX: Record<string, string> = {
  'zh-CN': 'CN',
  'zh-TW': 'TC',
  'en': 'EN',
  'ja': 'JP',
  'ko': 'KR',
}

/**
 * Load a single-locale TextTable from AKEData/TableCfg.
 * Keys are int64 text IDs (as strings); values are localized text.
 */
export function loadTextTable(akedataPath: string, locale: string): Record<string, string> {
  const suffix = TEXTTABLE_SUFFIX[locale] ?? locale
  try {
    return JSON.parse(readFileSync(join(akedataPath, 'TableCfg', `I18nTextTable_${suffix}.json`), 'utf-8'))
  } catch { return {} }
}

/** Load TextTables for all supported locales from AKEData/TableCfg. */
export function loadAllTextTables(akedataPath: string): Record<string, Record<string, string>> {
  const tables: Record<string, Record<string, string>> = {}
  for (const loc of [...SUPPORTED_LOCALES, 'ko']) {
    tables[loc] = loadTextTable(akedataPath, loc)
  }
  return tables
}

/**
 * Build mappings from GemTable using the lossless JSON parser:
 *   - cnToGem:  CN stat name → gemTermId  (for special-ability lookup by base skillName)
 *   - gemToCn:  gemTermId → CN stat name
 *   - gemToTextId: gemTermId → tagName.id (the TextTable key for the BASE stat name)
 *   - tagToGem: upstream tagId → gemTermId (for weapon passive skills)
 * `gemToTextId` lets callers resolve translations directly from a gemTermId without
 * the fragile full-skillName reverse-lookup against the TextTable (which fails for
 * gst_passive_* abilities whose weapon skillName carries a suffix the TextTable
 * does not store, e.g. "流转·汲罪" vs base "流转").
 */
export function buildGemTableLookup(
  akedataPath: string,
): {
  cnToGem: Record<string, string>
  gemToCn: Record<string, string>
  gemToTextId: Record<string, string>
  tagToGem: Record<string, string>
} {
  const cnToGem: Record<string, string> = {}
  const gemToCn: Record<string, string> = {}
  const gemToTextId: Record<string, string> = {}
  const tagToGem: Record<string, string> = {}
  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  if (!existsSync(gemTablePath)) return { cnToGem, gemToCn, gemToTextId, tagToGem }

  const textTables = loadTextTable(akedataPath, 'zh-CN')
  const gemTable = parseJsonSafe(gemTablePath) as Record<string, {
    gemTermId?: string
    tagId?: string
    tagName?: { id?: string }
  }>

  for (const [entryId, entry] of Object.entries(gemTable)) {
    const gemId = entry.gemTermId ?? entryId
    if (!/^g[as]t_/.test(gemId)) continue

    if (entry.tagId) tagToGem[entry.tagId] = gemId
    const textId = entry.tagName?.id
    if (!textId || textId === '0') continue

    gemToTextId[gemId] = textId
    const cn = textTables[textId]
    if (cn) {
      cnToGem[cn] = gemId
      gemToCn[gemId] = cn
    }
  }

  return { cnToGem, gemToCn, gemToTextId, tagToGem }
}
