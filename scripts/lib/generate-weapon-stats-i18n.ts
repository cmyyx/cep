// Generates weaponStats/ i18n from weapon JSON skillNames.
// Key = gemTermId, value = translated base name (without suffix like ·大 / [L]).
// ================================================================================

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGemTableLookup, loadTextTable } from './stat-mapping'

const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const

/**
 * Remove stat suffix patterns from skill name.
 * CN/JP: 压制·苦痛重叠 → 压制
 * EN/TW: Suppression: Emergency Boost → Suppression
 * Stat boosts: ATK Boost [L] → ATK Boost
 */
function stripSuffix(name: string): string {
  return name
    .replace(/[·・]\s*[^·・:]+$/, '')   // CN/JP suffix
    .replace(/:\s*[^:·・]+$/, '')        // EN/TW suffix
    .replace(/\s*\[[LMS]\]\s*$/, '')     // [L]/[M]/[S] suffix
    .trim()
}

export interface WeaponStatsI18nResult {
  written: string[]
  count: number
  missing: number
}

export function generateWeaponStatsI18n(
  imagedbPath: string,
  akedataPath: string,
  translationPath: string,
  outputDir: string,
): WeaponStatsI18nResult {
  const weaponDir = join(imagedbPath, 'public', 'CH', 'weapon')
  const fallbackDir = join(akedataPath, 'output', 'CN', 'weapon')
  const dir = existsSync(weaponDir) ? weaponDir : existsSync(fallbackDir) ? fallbackDir : null
  if (!dir) return { written: [], count: 0, missing: 0 }

  const textTables: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) {
    const suffix = { 'zh-CN': 'CN', 'zh-TW': 'TC', 'en': 'EN', 'ja': 'JP' }[loc]
    try {
      textTables[loc] = JSON.parse(readFileSync(join(translationPath, 'i18n', `I18nTextTable_${suffix}.json`), 'utf-8'))
    } catch { textTables[loc] = {} }
  }

  // Build blackboard key → gemTermId mapping (same as generate-weapon-stat-mapping.ts)
  const BB_TO_SUFFIX: Record<string, string> = {
    str: 'str', agi: 'agi', wisd: 'wisd', will: 'will', mainattr: 'main',
    atk: 'atk', hp: 'hp', phydam: 'phydam',
    firedam: 'firedam', electrondam: 'pulsedam', pulsedam: 'pulsedam',
    icedam: 'icedam', crystdam: 'icedam',
    naturaldam: 'naturaldam', crirate: 'crirate',
    usp: 'usp', usgs: 'usp',
    heal: 'heal', physpell: 'physpell', spelldam: 'magicdam',
  }

  // Build GemTable lookup for special abilities (gst_passive_*)
  const { cnToGem } = buildGemTableLookup(akedataPath, translationPath)

  // Collect unique skillName → gemTermId
  const seen = new Map<string, { gemId: string; cnFull: string }>()

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'))

    for (const skill of (data.skilllist ?? []) as Array<{ skillName: string; blackboard?: { key: string }[] }>) {
      const fullName = skill.skillName
      const baseName = stripSuffix(fullName)

      if (seen.has(baseName)) continue

      const bbKey = skill.blackboard?.[0]?.key
      let gemId: string | undefined
      if (bbKey) {
        const suffix = BB_TO_SUFFIX[bbKey]
        if (suffix) gemId = `gat_passive_attr_${suffix}`
      }
      if (!gemId) gemId = cnToGem[baseName] // special ability

      if (gemId && !seen.has(baseName)) {
        seen.set(baseName, { gemId, cnFull: fullName })
      }
    }
  }

  // Search TextTable for each full skillName to get translations
  const cnTextTable = textTables['zh-CN']
  const nameToTextId = new Map<string, string>()
  for (const [textId, text] of Object.entries(cnTextTable)) {
    nameToTextId.set(text, textId)
  }

  const i18nData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) i18nData[loc] = {}

  let count = 0
  let missing = 0

  for (const [baseName, { gemId, cnFull }] of seen) {
    const textId = nameToTextId.get(cnFull)
    for (const loc of SUPPORTED_LOCALES) {
      let text = ''
      if (textId) {
        text = textTables[loc]?.[textId] ?? ''
        text = stripSuffix(text)
      }
      if (!text) {
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
