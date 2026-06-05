// Shared utility: build CN stat name → gemTermId mapping from GemTable.
// Uses int64-safe regex extraction. Handles weapon skillName divergences
// via substring fallback matching (2 known cases out of 30).
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Load single-locale TextTable (standard JSON, keys are already strings). */
export function loadTextTable(translationPath: string, locale: string): Record<string, string> {
  const suffixMap: Record<string, string> = { 'zh-CN': 'CN', 'zh-TW': 'TC', 'en': 'EN', 'ja': 'JP' }
  const suffix = suffixMap[locale] ?? locale
  try {
    return JSON.parse(readFileSync(join(translationPath, 'i18n', `I18nTextTable_${suffix}.json`), 'utf-8'))
  } catch { return {} }
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
export function buildStatMapping(
  akedataPath: string,
  translationPath: string,
): StatMapping {
  const exact: Record<string, string> = {}
  const gemNames: string[] = []

  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  if (!existsSync(gemTablePath)) return { exact, gemNames, resolve(cn: string) { return cn } }

  const textTables = loadTextTable(translationPath, 'zh-CN')
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
 * Build raw CN stat name → gemTermId map from GemTable (int64-safe regex).
 * No substring fallback — pure exact mapping. Used for special ability lookup
 * and anywhere that needs the raw GemTable mapping.
 */
export function buildGemTableLookup(
  akedataPath: string,
  translationPath: string,
): { cnToGem: Record<string, string>; gemToCn: Record<string, string> } {
  const cnToGem: Record<string, string> = {}
  const gemToCn: Record<string, string> = {}

  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  if (!existsSync(gemTablePath)) return { cnToGem, gemToCn }

  const textTables = loadTextTable(translationPath, 'zh-CN')
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
        cnToGem[cn] = gemId
        gemToCn[gemId] = cn
      }
    }
  }

  return { cnToGem, gemToCn }
}
