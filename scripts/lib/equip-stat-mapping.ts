// Shared utility: map equip CN stat names to canonical keys (attrType or compositeAttr).
// Used by equip data migration, sync generation, and validation.
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseLossless } from 'lossless-json'

// ── Lossless JSON parsing (int64-safe) ───────────────────────────────────

function parseJsonSafe(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parseLossless(raw)
  function convert(value: unknown): unknown {
    if (value === null || value === undefined) return value
    if (typeof value === 'object' && 'isLosslessNumber' in value) return String(value)
    if (Array.isArray(value)) return value.map(convert)
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = convert(v)
      }
      return result
    }
    return value
  }
  return convert(parsed)
}

function loadCnTextTable(translationPath: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(join(translationPath, 'i18n', 'I18nTextTable_CN.json'), 'utf-8'))
  } catch { return {} }
}

// ── Equip stat mapping ──────────────────────────────────────────────────

export interface EquipStatMapping {
  /** Resolve a CN stat name to canonical key (attrType or compositeAttr). */
  resolve: (cnName: string) => string
}

export function buildEquipStatMapping(
  akedataPath: string,
  translationPath: string,
): EquipStatMapping {
  const tt = loadCnTextTable(translationPath)

  // 1. AttributeShowConfigTable: CN name → attrType
  const cnToAttrType: Record<string, string> = {}
  const attrCfgPath = join(akedataPath, 'TableCfg', 'AttributeShowConfigTable.json')
  if (existsSync(attrCfgPath)) {
    const cfg = parseJsonSafe(attrCfgPath) as Record<string, { list: { name: { id: string } }[] }>
    for (const [attrType, data] of Object.entries(cfg)) {
      if (!data.list?.[0]?.name?.id) continue
      const cn = tt[data.list[0].name.id]
      if (cn) cnToAttrType[cn] = attrType
    }
  }

  // 2. CompositeAttributeShowConfigTable: CN name → compositeAttr
  const cnToComposite: Record<string, string> = {}
  const compCfgPath = join(akedataPath, 'TableCfg', 'CompositeAttributeShowConfigTable.json')
  if (existsSync(compCfgPath)) {
    const cfg = parseJsonSafe(compCfgPath) as Record<string, { list: { name: { id: string } }[] }>
    for (const [compositeAttr, data] of Object.entries(cfg)) {
      if (!data.list?.[0]?.name?.id) continue
      const cn = tt[data.list[0].name.id]
      if (cn) cnToComposite[cn] = compositeAttr
    }
  }

  return {
    resolve(cnName: string): string {
      // 1. attrType
      if (cnToAttrType[cnName]) return cnToAttrType[cnName]
      // 2. compositeAttr
      if (cnToComposite[cnName]) return cnToComposite[cnName]
      // 3. Fallback: CN name itself (should not happen with valid data)
      return cnName
    },
  }
}
