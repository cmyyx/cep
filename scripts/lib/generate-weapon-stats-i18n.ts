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

export interface WeaponStatsI18nResult {
  written: string[]
  count: number
  missing: number
}

// ── Blackboard key → gemTermId suffix ──

const BLACKBOARD_TO_GEM_SUFFIX: Record<string, string> = {
  str: 'str', agi: 'agi', wisd: 'wisd', will: 'will', mainattr: 'main',
  atk: 'atk', hp: 'hp', phydam: 'phydam',
  firedam: 'firedam', electrondam: 'pulsedam', pulsedam: 'pulsedam',
  icedam: 'icedam', crystdam: 'icedam',
  naturaldam: 'naturaldam', crirate: 'crirate',
  usp: 'usp', usgs: 'usp',
  heal: 'heal', physpell: 'physpell', spelldam: 'magicdam',
}

/** Extract base stat name from skill full name (before '·' / ':' / '[LMS]'). */
function extractBaseStatName(skillName: string): string {
  return skillName
    .replace(/[·・]\s*[^·・:]+$/, '')
    .replace(/:\s*[^:·・]+$/, '')
    .replace(/\s*\[[LMS]\]\s*$/, '')
    .trim()
}

// ── SkillPatchTable types ──

interface SkillPatchBundle {
  blackboard?: { key: string; value: number }[]
  skillId: string
  skillName: { id: string; text: string }
}

interface SkillPatchEntry {
  SkillPatchDataBundle: SkillPatchBundle[]
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateWeaponStatsI18n(
  akedataPath: string,
  outputDir: string,
): WeaponStatsI18nResult {
  // Load WeaponBasicTable for weaponSkillList
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  if (!existsSync(wpnBasicPath)) return { written: [], count: 0, missing: 0 }

  const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, { weaponSkillList?: string[] }>

  // Load SkillPatchTable (lossless-json for int64-safe skillName.id)
  const skillPatchPath = join(akedataPath, 'TableCfg', 'SkillPatchTable.json')
  if (!existsSync(skillPatchPath)) return { written: [], count: 0, missing: 0 }

  const skillPatch = parseJsonSafe(skillPatchPath) as Record<string, SkillPatchEntry>

  const textTables = loadAllTextTables(akedataPath)

  // GemTable lookup: cnToGem (special-ability resolution) + gemToTextId (direct
  // textId lookup so we never reverse-search the TextTable by skill name).
  const { cnToGem, gemToCn, gemToTextId } = buildGemTableLookup(akedataPath)
  // Load CN TextTable for resolving skillName.id → CN text
  const cnTextTable = loadTextTable(akedataPath, 'zh-CN')

  // Collect unique gemTermId → baseName pairs (dedup by gemTermId, first occurrence wins).
  const seen = new Map<string, string>()

  // Iterate WeaponBasicTable entries
  for (const [, wpnData] of Object.entries(wpnBasic)) {
    const skillList = wpnData.weaponSkillList ?? []
    for (const skillId of skillList) {
      const entry = skillPatch[skillId]
      if (!entry?.SkillPatchDataBundle?.[0]) continue

      const bundle = entry.SkillPatchDataBundle[0]
      const bbKey = bundle.blackboard?.[0]?.key

      // Try blackboard key → gemTermId suffix
      let gemId: string | undefined
      if (bbKey) {
        const suffix = BLACKBOARD_TO_GEM_SUFFIX[bbKey]
        if (suffix) gemId = `gat_passive_attr_${suffix}`
      }

      // Special ability: resolve skillName.id → CN text → extract baseName → cnToGem
      if (!gemId) {
        const skillTextId = bundle.skillName?.id
        if (skillTextId) {
          const cnName = cnTextTable[skillTextId]
          if (cnName) {
            const baseName = extractBaseStatName(cnName)
            gemId = cnToGem[baseName]
            if (gemId && !seen.has(gemId)) seen.set(gemId, baseName)
          }
        }
        continue
      }

      // Blackboard-mapped stat: use gemToCn as fallback baseName
      if (!seen.has(gemId)) {
        seen.set(gemId, gemToCn[gemId] ?? bbKey ?? '')
      }
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
