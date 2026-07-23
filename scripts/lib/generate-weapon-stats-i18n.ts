// Generates weaponStats/ i18n from WeaponBasicTable + SkillPatchTable.
// Key = gemTermId, value = translated base stat name.
//
// Translation resolution uses gemId → textId (from GemTable.tagName.id) → TextTable.
// This bypasses the fragile full-skillName reverse-lookup against the TextTable,
// which failed for gst_passive_* special abilities: their weapon skillName carries
// a per-weapon suffix (e.g. "流转·汲罪") that the TextTable does not store — only
// the base stat name ("流转") exists as a GemTable tagName. Resolving via gemId
// guarantees every gat_passive_attr_* and gst_passive_* key maps to the correct
// textId uniformly.
// ================================================================================

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import { buildGemTableLookup, loadAllTextTables, loadTextTable, SUPPORTED_LOCALES } from './stat-mapping'
import { resolveWeaponStats } from './weapon-stats'
import type { WeaponSkillPatchEntry } from './weapon-stats'

export interface WeaponStatsI18nResult {
  written: string[]
  count: number
  missing: number
}


// ── Main generator ────────────────────────────────────────────────────────────

export function generateWeaponStatsI18n(
  akedataPath: string,
  outputDir: string,
): WeaponStatsI18nResult {
  // Load WeaponBasicTable for weaponSkillList
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  if (!existsSync(wpnBasicPath)) return { written: [], count: 0, missing: 0 }

  const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, { rarity?: number; weaponSkillList?: string[] }>

  // Load SkillPatchTable (lossless-json for int64-safe skillName.id)
  const skillPatchPath = join(akedataPath, 'TableCfg', 'SkillPatchTable.json')
  if (!existsSync(skillPatchPath)) return { written: [], count: 0, missing: 0 }

  const skillPatch = parseJsonSafe(skillPatchPath) as Record<string, WeaponSkillPatchEntry>

  const textTables = loadAllTextTables(akedataPath)

  // GemTable lookup: cnToGem (special-ability resolution) + gemToTextId (direct
  // textId lookup so we never reverse-search the TextTable by skill name).
  const { cnToGem, gemToCn, gemToTextId, tagToGem } = buildGemTableLookup(akedataPath)
  // Load CN TextTable for resolving skillName.id → CN text
  const cnTextTable = loadTextTable(akedataPath, 'zh-CN')

  // Collect unique gemTermId → baseName pairs (dedup by gemTermId, first occurrence wins).
  const seen = new Map<string, string>()

  // Iterate through the shared resolver so generation, reconciliation, and
  // validation always agree about which upstream skill belongs to each slot.
  for (const [weaponId, wpnData] of Object.entries(wpnBasic)) {
    if ((wpnData.rarity ?? 1) < 3) continue
    const stats = resolveWeaponStats(
      wpnData.weaponSkillList ?? [],
      skillPatch,
      tagToGem,
      cnTextTable,
      cnToGem,
    )
    if (stats.unresolvedSkillIds.length > 0) {
      throw new Error(`Unable to resolve upstream weapon skills for ${weaponId}: ${stats.unresolvedSkillIds.join(', ')}`)
    }
    for (const gemId of [stats.primaryStat, stats.elementalDamage, stats.specialAbility]) {
      if (gemId && !seen.has(gemId)) seen.set(gemId, gemToCn[gemId] ?? gemId)
    }
  }
  const i18nData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) i18nData[loc] = {}

  let count = 0
  let missing = 0

  for (const [gemId, baseName] of seen) {
    const textId = gemToTextId[gemId]

    for (const loc of SUPPORTED_LOCALES) {
      let text = ''
      if (textId) {
        text = textTables[loc]?.[textId] ?? ''
      }
      if (!text) {
        // No textId (GemTable entry without tagName.id) or no translation for this
        // locale — fall back to the CN base name so the UI never shows a raw key.
        text = baseName
        if (!textId || !(textTables[loc]?.[textId])) missing++
      }
      i18nData[loc][gemId] = String(text).replace(/\n/g, ' ').trim()
    }
    count++
  }

  const outDir = join(outputDir, 'weaponStats')
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(outDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(i18nData[loc], null, 2) + '\n', 'utf-8')
    written.push(path)
  }

  return { written, count, missing }
}
