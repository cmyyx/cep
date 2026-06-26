// Shared utilities for loading TextTables and building CN stat name → gemTermId mappings.
//
// i18n source: AKEData/TableCfg/I18nTextTable_{locale}.json (single upstream repo,
// EndFieldTranslationReferrer has been abandoned — it was a stale second-hand copy).
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Locales supported by the project. */
export const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const

/** TextTable filename suffix per locale (game uses CN/EN/JP/TC, not BCP-47). */
export const TEXTTABLE_SUFFIX: Record<string, string> = {
  'zh-CN': 'CN',
  'zh-TW': 'TC',
  'en': 'EN',
  'ja': 'JP',
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
  for (const loc of SUPPORTED_LOCALES) {
    tables[loc] = loadTextTable(akedataPath, loc)
  }
  return tables
}

export interface StatMapping {
  /** Exact matches: CN name → gemTermId */
  exact: Record<string, string>
  /** All GemTable CN names (for substring fallback) */
  gemNames: string[]
  /** Resolve any CN stat name to gemTermId */
  resolve: (cnName: string) => string
}

/**
 * Build CN stat name → gemTermId mapping from GemTable (int64-safe regex).
 */
export function buildStatMapping(akedataPath: string): StatMapping {
  const exact: Record<string, string> = {}
  const gemNames: string[] = []

  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  if (!existsSync(gemTablePath)) return { exact, gemNames, resolve(cn: string) { return cn } }

  const textTables = loadTextTable(akedataPath, 'zh-CN')
  const raw = readFileSync(gemTablePath, 'utf-8')
  const re = /"(g[as]t_\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null

  while ((m = re.exec(raw)) !== null) {
    const gemId = m[1]
    const window = raw.substring(m.index, m.index + 2000)
    const tagMatch = window.match(/"tagName"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)
    if (tagMatch?.[1]) {
      const cn = textTables[tagMatch[1]]
      if (cn) {
        exact[cn] = gemId
        gemNames.push(cn)
      }
    }
  }

  return {
    exact,
    gemNames,
    resolve(cnName: string): string {
      if (exact[cnName]) return exact[cnName]
      for (const gemCn of gemNames) {
        if (gemCn.includes(cnName) || cnName.includes(gemCn)) {
          return exact[gemCn]
        }
      }
      return cnName
    },
  }
}

/**
 * Build raw mappings from GemTable (int64-safe regex):
 *   - cnToGem:  CN stat name → gemTermId  (for special-ability lookup by base skillName)
 *   - gemToCn:  gemTermId → CN stat name
 *   - gemToTextId: gemTermId → tagName.id (the TextTable key for the BASE stat name)
 *
 * `gemToTextId` lets callers resolve translations directly from a gemTermId without
 * the fragile full-skillName reverse-lookup against the TextTable (which fails for
 * gst_passive_* abilities whose weapon skillName carries a suffix the TextTable
 * does not store, e.g. "流转·汲罪" vs base "流转").
 */
export function buildGemTableLookup(
  akedataPath: string,
): { cnToGem: Record<string, string>; gemToCn: Record<string, string>; gemToTextId: Record<string, string> } {
  const cnToGem: Record<string, string> = {}
  const gemToCn: Record<string, string> = {}
  const gemToTextId: Record<string, string> = {}

  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  if (!existsSync(gemTablePath)) return { cnToGem, gemToCn, gemToTextId }

  const textTables = loadTextTable(akedataPath, 'zh-CN')
  const raw = readFileSync(gemTablePath, 'utf-8')
  const re = /"(g[as]t_\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null

  while ((m = re.exec(raw)) !== null) {
    const gemId = m[1]
    const window = raw.substring(m.index, m.index + 2000)
    const tagMatch = window.match(/"tagName"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)
    if (tagMatch?.[1]) {
      const textId = tagMatch[1]
      gemToTextId[gemId] = textId
      const cn = textTables[textId]
      if (cn) {
        cnToGem[cn] = gemId
        gemToCn[gemId] = cn
      }
    }
  }

  return { cnToGem, gemToCn, gemToTextId }
}
