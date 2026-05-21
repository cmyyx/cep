// Generates src/generated/i18n/{category}/{locale}.json from upstream TextTable files.
// ================================================================================

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const
type Locale = (typeof SUPPORTED_LOCALES)[number]

// TextTable locale filenames use different suffixes than our project
const TEXTTABLE_SUFFIX: Record<string, string> = {
  'zh-CN': 'CN',
  'zh-TW': 'TC',
  'en': 'EN',
  'ja': 'JP',
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface I18nGenerationResult {
  category: string
  generated: string[]       // paths of files written
  missingEntries: string[]  // warnings about entries without translations
}

/**
 * Generate i18n files for a category from the TextTable.
 *
 * @param outputDir - root of src/generated/i18n/
 * @param translations - map from TextTable locale suffix → full TextTable object
 * @param entries - array of { id: gameId, textId: numeric text ID }
 * @param category - folder name e.g. 'weapons', 'equips'
 * @param cnFallback - optional CN fallback map (id → CN text) for when TextTable CN is empty
 */
export function generateCategoryI18n(
  outputDir: string,
  translations: Record<string, Record<string, string>>,
  entries: { id: string; textId: string }[],
  category: string,
  cnFallback?: Record<string, string>,
): I18nGenerationResult {
  const result: I18nGenerationResult = { category, generated: [], missingEntries: [] }

  for (const locale of SUPPORTED_LOCALES) {
    const suffix = TEXTTABLE_SUFFIX[locale]
    const table = translations[suffix]
    if (!table) {
      console.warn(`  [i18n] no TextTable data for locale ${locale} (suffix=${suffix})`)
      continue
    }

    const data: Record<string, string> = {}
    for (const { id, textId } of entries) {
      let text = table[textId]
      if (!text && locale === 'zh-CN' && cnFallback) {
        text = cnFallback[id]
      }
      if (!text) {
        // Fallback chain: EN → CN suffix → cnFallback → id
        text = table[textId] ?? translations['CN']?.[textId] ?? cnFallback?.[id] ?? id
        if (!table[textId]) {
          result.missingEntries.push(`${category}/${locale}: ${id} (textId=${textId})`)
        }
      }
      data[id] = text.replace(/\n/g, ' ').trim()
    }

    const filePath = join(outputDir, category, `${locale}.json`)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    result.generated.push(filePath)
  }

  return result
}

/**
 * Generate stat/term i18n files.
 * These don't use TextTable IDs — terms are keyed by their own name.
 */
export function generateStatI18n(
  outputDir: string,
  translations: Record<string, Record<string, string>>,
  terms: string[],
  termTextIds: Record<string, string>,  // term → TextTable ID
): I18nGenerationResult {
  const result: I18nGenerationResult = { category: 'stats', generated: [], missingEntries: [] }

  for (const locale of SUPPORTED_LOCALES) {
    const suffix = TEXTTABLE_SUFFIX[locale]
    const table = translations[suffix]
    if (!table) continue

    const data: Record<string, string> = {}
    for (const term of terms) {
      const textId = termTextIds[term]
      let text = textId ? table[textId] : undefined
      if (!text) {
        // Fallback: use CN table or the term itself
        text = table[term] ?? translations['CN']?.[textId ?? ''] ?? term
        if (!table[textId ?? '']) {
          result.missingEntries.push(`stats/${locale}: ${term}`)
        }
      }
      data[term] = text
    }

    const filePath = join(outputDir, 'stats', `${locale}.json`)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    result.generated.push(filePath)
  }

  return result
}
