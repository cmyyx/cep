// Generates weaponStats/ i18n from weapon JSON skillNames.
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

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGemTableLookup, loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'

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

export function generateWeaponStatsI18n(
  imagedbPath: string,
  akedataPath: string,
  outputDir: string,
): WeaponStatsI18nResult {
  const weaponDir = join(imagedbPath, 'public', 'CH', 'weapon')
  const fallbackDir = join(akedataPath, 'output', 'CN', 'weapon')
  const dir = existsSync(weaponDir) ? weaponDir : existsSync(fallbackDir) ? fallbackDir : null
  if (!dir) return { written: [], count: 0, missing: 0 }

  const textTables = loadAllTextTables(akedataPath)

  // GemTable lookup: cnToGem (special-ability resolution) + gemToTextId (direct
  // textId lookup so we never reverse-search the TextTable by skill name).
  const { cnToGem, gemToTextId } = buildGemTableLookup(akedataPath)

  // Collect unique gemTermId → baseName pairs (dedup by gemTermId, first occurrence wins).
  // Deduping by gemId (the i18n output key) ensures each output entry is written
  // exactly once. baseName-based dedup allowed different baseNames sharing a gemId
  // (e.g. pulsedam/electrondam → gat_passive_attr_pulsedam) to overwrite each other
  // non-deterministically in the output map keyed by gemId.
  const seen = new Map<string, string>()

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'))

    for (const skill of (data.skilllist ?? []) as Array<{ skillName: string; blackboard?: { key: string }[] }>) {
      const fullName = skill.skillName
      // Derive base name (before '·' / ':' / '[L]') for special-ability CN lookup.
      const baseName = fullName
        .replace(/[·・]\s*[^·・:]+$/, '')
        .replace(/:\s*[^:·・]+$/, '')
        .replace(/\s*\[[LMS]\]\s*$/, '')
        .trim()

      const bbKey = skill.blackboard?.[0]?.key
      let gemId: string | undefined
      if (bbKey) {
        const suffix = BLACKBOARD_TO_GEM_SUFFIX[bbKey]
        if (suffix) gemId = `gat_passive_attr_${suffix}`
      }
      if (!gemId) gemId = cnToGem[baseName] // special ability (gst_passive_*)

      if (gemId && !seen.has(gemId)) seen.set(gemId, baseName)
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
