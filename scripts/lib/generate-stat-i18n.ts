// Generates gemStats/ and equipStats/ i18n from upstream game data.
//
// gemStats/  – GemTable → tagName.id → TextTable (weapons + dungeons display)
// equipStats/ – AttributeShowConfigTable + CompositeAttributeShowConfigTable
//               → name.id → TextTable (equipment display)
//
// All int64 text IDs are extracted via regex or lossless-json to avoid
// JavaScript Number truncation (> 2^53).
// ================================================================================

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import { loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'

// ── GemTable extraction (regex, int64-safe) ──────────────────────────────

interface GemTermEntry {
  gemTermId: string
  textId: string
}

/** Extract gemTermId → tagName.id (raw string) from GemTable.json via regex */
function extractGemTableTextIds(gemTablePath: string): GemTermEntry[] {
  if (!existsSync(gemTablePath)) return []
  const raw = readFileSync(gemTablePath, 'utf-8')
  const entries: GemTermEntry[] = []
  const re = /"(g[as]t_\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const gemTermId = m[1]
    const window = raw.substring(m.index, m.index + 2000)
    const tagMatch = window.match(/"tagName"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)
    if (tagMatch?.[1] && tagMatch[1] !== '0') {
      entries.push({ gemTermId, textId: tagMatch[1] })
    }
  }
  return entries
}

// ── AttributeShowConfigTable extraction (lossless-json) ──────────────────

interface AttrConfigEntry {
  attrType: string
  textId: string
  showPercent: boolean
}

function extractAttrShowConfig(akedataPath: string): AttrConfigEntry[] {
  const path = join(akedataPath, 'TableCfg', 'AttributeShowConfigTable.json')
  if (!existsSync(path)) return []
  const config = parseJsonSafe(path) as Record<string, {
    list: { name: { id: string }; showPercent: boolean }[]
  }>
  const entries: AttrConfigEntry[] = []
  for (const [attrType, data] of Object.entries(config)) {
    if (!data.list || data.list.length === 0) continue
    const first = data.list[0]
    if (first.name?.id && first.name.id !== '0') {
      entries.push({ attrType, textId: first.name.id, showPercent: first.showPercent })
    }
  }
  return entries
}

// ── CompositeAttributeShowConfigTable extraction (lossless-json) ─────────

interface CompositeAttrEntry {
  compositeAttr: string
  textId: string
}

function extractCompositeAttrShowConfig(akedataPath: string): CompositeAttrEntry[] {
  const path = join(akedataPath, 'TableCfg', 'CompositeAttributeShowConfigTable.json')
  if (!existsSync(path)) return []
  const config = parseJsonSafe(path) as Record<string, {
    list: { name: { id: string } }[]
  }>
  const entries: CompositeAttrEntry[] = []
  for (const [compositeAttr, data] of Object.entries(config)) {
    if (!data.list || data.list.length === 0) continue
    const first = data.list[0]
    if (first.name?.id && first.name.id !== '0') {
      entries.push({ compositeAttr, textId: first.name.id })
    }
  }
  return entries
}

// ── Result type ──────────────────────────────────────────────────────────

export interface StatI18nResult {
  gemWritten: string[]
  equipWritten: string[]
  gemCount: number
  equipCount: number
  equipUnmatched: string[]
  missing: number
}

// ── Main generator ───────────────────────────────────────────────────────

export function generateStatI18n(
  akedataPath: string,
  imagedbPath: string,
  outputDir: string,
): StatI18nResult {
  const result: StatI18nResult = {
    gemWritten: [], equipWritten: [],
    gemCount: 0, equipCount: 0, equipUnmatched: [], missing: 0,
  }

  const textTables = loadAllTextTables(akedataPath)

  // ── gemStats: from GemTable ────────────────────────────────────────────

  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  const gemEntries = extractGemTableTextIds(gemTablePath)

  const gemData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) gemData[loc] = {}

  for (const entry of gemEntries) {
    for (const loc of SUPPORTED_LOCALES) {
      let text = textTables[loc]?.[entry.textId] ?? ''
      if (!text) {
        text = textTables['zh-CN']?.[entry.textId] ?? entry.gemTermId
        if (!textTables[loc]?.[entry.textId]) result.missing++
      }
      gemData[loc][entry.gemTermId] = String(text).replace(/\n/g, ' ').trim()
    }
    result.gemCount++
  }

  const gemOutDir = join(outputDir, 'gemStats')
  mkdirSync(gemOutDir, { recursive: true })
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(gemOutDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(gemData[loc], null, 2) + '\n', 'utf-8')
    result.gemWritten.push(path)
  }

  // ── equipStats: from v2_equip displayAttrModifiers + Composite ──────

  const v2EquipDir = join(imagedbPath, 'public', 'CH', 'v2_equip')
  const usedAttrTypes = new Set<string>()
  const usedCompositeAttrs = new Set<string>()

  if (existsSync(v2EquipDir)) {
    for (const file of readdirSync(v2EquipDir)) {
      if (!file.endsWith('.json') || file === 'manifest.json') continue
      const data = JSON.parse(readFileSync(join(v2EquipDir, file), 'utf-8'))
      const et = data.equiptable as Record<string, Record<string, unknown>> | undefined
      if (!et) continue
      for (const [, ed] of Object.entries(et)) {
        for (const mod of (ed.displayAttrModifiers as Array<Record<string, unknown>>) ?? []) {
          const attrType = String(mod.attrType ?? '')
          const compositeAttr = String(mod.compositeAttr ?? '')
          if (attrType && attrType !== '0') usedAttrTypes.add(attrType)
          if (compositeAttr) usedCompositeAttrs.add(compositeAttr)
        }
      }
    }
  }

  const equipData: Record<string, Record<string, string>> = {}
  for (const loc of SUPPORTED_LOCALES) equipData[loc] = {}

  const attrEntries = extractAttrShowConfig(akedataPath)
  const compositeEntries = extractCompositeAttrShowConfig(akedataPath)
  const attrByType = new Map(attrEntries.map(e => [e.attrType, e]))

  // A. Standard equip stats — key = attrType (upstream canonical ID)
  for (const attrType of usedAttrTypes) {
    const entry = attrByType.get(attrType)
    if (!entry) continue

    for (const loc of SUPPORTED_LOCALES) {
      let text = textTables[loc]?.[entry.textId] ?? ''
      if (!text) {
        const cnFallback = textTables['zh-CN']?.[entry.textId] ?? attrType
        text = cnFallback
        if (!textTables[loc]?.[entry.textId]) result.missing++
      }
      equipData[loc][attrType] = String(text).replace(/\n/g, ' ').trim()
    }
    result.equipCount++
  }

  // B. Compound equip stats — key = compositeAttr (upstream canonical ID)
  const compositeByKey = new Map(compositeEntries.map(e => [e.compositeAttr, e]))

  for (const compositeAttr of usedCompositeAttrs) {
    const entry = compositeByKey.get(compositeAttr)
    if (!entry) {
      result.equipUnmatched.push(`compositeAttr=${compositeAttr} (no config entry)`)
      continue
    }
    for (const loc of SUPPORTED_LOCALES) {
      let text = textTables[loc]?.[entry.textId] ?? ''
      if (!text) {
        const cnFallback = textTables['zh-CN']?.[entry.textId] ?? compositeAttr
        text = cnFallback
        if (!textTables[loc]?.[entry.textId]) result.missing++
      }
      equipData[loc][compositeAttr] = String(text).replace(/\n/g, ' ').trim()
    }
    result.equipCount++
  }

  const equipOutDir = join(outputDir, 'equipStats')
  mkdirSync(equipOutDir, { recursive: true })
  for (const loc of SUPPORTED_LOCALES) {
    const path = join(equipOutDir, `${loc}.json`)
    writeFileSync(path, JSON.stringify(equipData[loc], null, 2) + '\n', 'utf-8')
    result.equipWritten.push(path)
  }

  return result
}
