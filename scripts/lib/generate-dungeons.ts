// Generates dungeon (Energy Alluvium) i18n from upstream game data.
// Sources:
//   - WorldEnergyPointGroupTable.json -> group definitions, term pools, gemCustomItemId
//   - WorldEnergyPointTable.json    -> per-level names (gameName.id)
//   - GemTable.json                 -> gem term display names (tagName.id -> TextTable)
//   - TextTable files              -> multi-language translations
//
// Uses raw regex extraction (not JSON.parse) for all int64 text ID fields
// to avoid JavaScript Number truncation (> 2^53).
//
// Naming convention: "{region}.{subRegion}" where region comes from gemCustomItemId
// mapping (tundra -> Valley IV, wuling -> Wuling).
// ================================================================================

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractEnergyPointGroupNames,
  extractEnergyPointLevel1Names,
  extractGemTermTextIds,
} from './extract-textid'

const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const
const TEXTTABLE_SUFFIX: Record<string, string> = { 'zh-CN': 'CN', 'zh-TW': 'TC', 'en': 'EN', 'ja': 'JP' }

/** Convert English name to camelCase key (e.g. "The Hub" -> "theHub") */
function toCamelCase(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .map((word, i) => {
      const clean = word.replace(/[^a-zA-Z0-9]/g, '')
      if (!clean) return ''
      return i === 0 ? clean.toLowerCase() : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
    })
    .filter(Boolean)
    .join('')
}

// Region mapping: gemCustomItemId suffix -> region display name
interface RegionInfo {
  key: string
  cnName: string
  enName: string
}

const REGION_MAP: Record<string, RegionInfo> = {
  tundra: { key: 'fourthValley', cnName: '四号谷地', enName: 'Valley IV' },
  wuling: { key: 'wuling', cnName: '武陵', enName: 'Wuling' },
}

function getRegionInfo(gemCustomItemId: string): RegionInfo {
  for (const [suffix, info] of Object.entries(REGION_MAP)) {
    if (gemCustomItemId.includes(suffix)) return info
  }
  return { key: 'unknown', cnName: '未知', enName: 'Unknown' }
}

// Types
interface DungeonGroupData {
  groupId: string
  nameTextId: string
  region: RegionInfo
  primAttrTermIds: string[]
  secAttrTermIds: string[]
  skillTermIds: string[]
}

export interface DungeonI18nResult {
  dungeonWritten: string[]
  regionWritten: string[]
  statsWritten: string[]
  dungeonCount: number
  regionCount: number
  statCount: number
  missing: number
}

export function generateDungeonI18n(
  akedataPath: string,
  translationPath: string,
  outputDir: string,
): DungeonI18nResult {
  const result: DungeonI18nResult = {
    dungeonWritten: [], regionWritten: [], statsWritten: [],
    dungeonCount: 0, regionCount: 0, statCount: 0, missing: 0,
  }

  const groupTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointGroupTable.json')
  const levelTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointTable.json')
  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')

  if (!existsSync(groupTablePath)) {
    console.warn('  [dungeons] WorldEnergyPointGroupTable.json not found')
    return result
  }

  // Load TextTable for all locales
  const textTables: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) {
    const suffix = TEXTTABLE_SUFFIX[loc]
    try {
      textTables[loc] = JSON.parse(readFileSync(join(translationPath, 'i18n', `I18nTextTable_${suffix}.json`), 'utf-8'))
    } catch { textTables[loc] = {} }
  }

  // Extract text IDs from raw JSON (preserves int64 precision)
  const groupNameMap = extractEnergyPointGroupNames(groupTablePath)
  const level1NameMap = extractEnergyPointLevel1Names(levelTablePath)
  const gemTermTextIds = extractGemTermTextIds(gemTablePath)

  // Parse group table for term pools and gemCustomItemId (no int64 IDs in these fields)
  const groupTable = JSON.parse(readFileSync(groupTablePath, 'utf-8')) as Record<string, Record<string, unknown>>

  const groups: DungeonGroupData[] = []

  for (const [groupId, gData] of Object.entries(groupTable)) {
    const level1Info = level1NameMap[groupId]
    const nameTextId = level1Info?.nameTextId ?? groupNameMap[groupId]?.nameTextId ?? ''
    if (!nameTextId) continue

    const gemCustomItemId = String(gData.gemCustomItemId ?? '')
    const region = getRegionInfo(gemCustomItemId)

    const primAttrTermIds = (gData.primAttrTermIds ?? []) as string[]
    const secAttrTermIds = (gData.secAttrTermIds ?? []) as string[]
    const skillTermIds = (gData.skillTermIds ?? []) as string[]

    groups.push({ groupId, nameTextId, region, primAttrTermIds, secAttrTermIds, skillTermIds })
  }

  // Extract sub-region names from level-1 gameName
  // "Energy Alluvium: The Hub" -> sub-region = "The Hub"
  function parseSubRegion(fullName: string): string {
    const parts = fullName.split(/[:\uff1a\u00b7\u30fb///]/).map(p => p.trim()).filter(Boolean)
    return parts.length >= 2 ? parts.slice(1).join('.') : parts[parts.length - 1] ?? fullName
  }

  // Generate region i18n
  const regionSet = new Set<string>()
  for (const group of groups) regionSet.add(group.region.key)

  const regionData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) regionData[loc] = {}

  const REGION_TRANSLATIONS: Record<string, Record<string, string>> = {
    fourthValley: { 'zh-CN': '四号谷地', 'zh-TW': '四號谷地', en: 'Valley IV', ja: '四号谷地' },
    wuling: { 'zh-CN': '武陵', 'zh-TW': '武陵', en: 'Wuling', ja: '武陵' },
    unknown: { 'zh-CN': '未知', 'zh-TW': '未知', en: 'Unknown', ja: '不明' },
  }

  for (const key of regionSet) {
    for (const loc of SUPPORTED_LOCALES) {
      regionData[loc][key] = REGION_TRANSLATIONS[key]?.[loc] ?? key
    }
    result.regionCount++
  }

  // Collect sub-region terms during dungeon loop, then write both together
  const subRegionTerms: { cnName: string; key: string; translations: Record<string, string> }[] = []

  // Generate dungeon name i18n: "{region}.{subRegion}"
  const dungeonData: Record<string, Record<string, string>> = {}

  for (const group of groups) {
    for (const loc of SUPPORTED_LOCALES) {
      const regionName = regionData[loc]?.[group.region.key] ?? group.region.cnName
      const locFullName = textTables[loc]?.[group.nameTextId]
        ?? textTables['zh-CN']?.[group.nameTextId]
        ?? group.groupId
      const subRegion = parseSubRegion(String(locFullName))
      const displayName = `${regionName}·${subRegion}`

      if (!dungeonData[loc]) dungeonData[loc] = {}
      dungeonData[loc][group.groupId] = displayName

      // Collect sub-region translations
      if (loc === 'zh-CN' && subRegion !== group.groupId) {
        const cnSubRaw = parseSubRegion(String(textTables['zh-CN']?.[group.nameTextId] ?? group.groupId))
        // Generate semantic key from English translation (camelCase)
        const enSubRaw = parseSubRegion(String(textTables['en']?.[group.nameTextId] ?? cnSubRaw))
        const semanticKey = toCamelCase(enSubRaw)
        // Check if already collected
        if (!subRegionTerms.some(t => t.cnName === cnSubRaw)) {
          const tr: Record<string, string> = {}
          for (const l of SUPPORTED_LOCALES) {
            const locFull = textTables[l]?.[group.nameTextId]
              ?? textTables['zh-CN']?.[group.nameTextId]
              ?? group.groupId
            tr[l] = parseSubRegion(String(locFull))
          }
          subRegionTerms.push({ cnName: cnSubRaw, key: semanticKey, translations: tr })
        }
      }
    }
    result.dungeonCount++
  }

  const dungeonOutDir = join(outputDir, 'dungeons')
  mkdirSync(dungeonOutDir, { recursive: true })
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(dungeonOutDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(dungeonData[loc] ?? {}, null, 2) + '\n', 'utf-8')
    result.dungeonWritten.push(path)
  }

  // Add sub-region translations to regionData (now populated from dungeon loop)
  for (const { key, translations } of subRegionTerms) {
    for (const loc of SUPPORTED_LOCALES) {
      regionData[loc][key] = translations[loc] ?? key
    }
  }

  // Write regions (after sub-region merge)
  const regionOutDir = join(outputDir, 'regions')
  mkdirSync(regionOutDir, { recursive: true })
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(regionOutDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(regionData[loc], null, 2) + '\n', 'utf-8')
    result.regionWritten.push(path)
  }

  // Generate stat/term i18n from GemTable (all pools: S1 + S2 + S3)
  const allGemTerms = [...new Set(groups.flatMap(g => [...g.primAttrTermIds, ...g.secAttrTermIds, ...g.skillTermIds]))]

  const statData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) statData[loc] = {}

  for (const gemTermId of allGemTerms) {
    const textId = gemTermTextIds[gemTermId]
    for (const loc of SUPPORTED_LOCALES) {
      let text = ''
      if (textId) {
        text = textTables[loc]?.[textId] ?? ''
      }
      if (!text) {
        text = textId ? (textTables['zh-CN']?.[textId] ?? gemTermId) : gemTermId
        if (!textId || !(textTables[loc]?.[textId])) result.missing++
      }
      statData[loc][gemTermId] = String(text).replace(/\n/g, ' ').trim()
    }
    result.statCount++
  }

  // Also generate compound equip stats (not in GemTable, direct TextTable lookup)
  const compoundStats = [
    '连携技伤害加成', '普通攻击伤害加成', '战技伤害加成',
    '终结技伤害加成', '所有技能伤害加成', '全伤害减免',
    '对失衡目标伤害加成', '寒冷和电磁伤害加成', '灼热和自然伤害加成',
    '副能力',
  ]
  for (const cnName of compoundStats) {
    // Find text ID by searching CN TextTable for exact match
    let textId = ''
    for (const [id, text] of Object.entries(textTables['zh-CN'] ?? {})) {
      if (text === cnName) { textId = id; break }
    }
    for (const loc of SUPPORTED_LOCALES) {
      let text = ''
      if (textId) text = textTables[loc]?.[textId] ?? ''
      if (!text) {
        text = cnName
        if (!textId) result.missing++
      }
      statData[loc][cnName] = String(text).replace(/\n/g, ' ').trim()
    }
    result.statCount++
  }

  const statsOutDir = join(outputDir, 'stats')
  mkdirSync(statsOutDir, { recursive: true })
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(statsOutDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(statData[loc], null, 2) + '\n', 'utf-8')
    result.statsWritten.push(path)
  }

  return result
}
