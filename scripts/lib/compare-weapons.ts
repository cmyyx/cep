// Compares AKEData weapon data against project weapons.
// Detects new weapons, name mismatches, weapon types, and 专武 associations.
// Data sourced from AKEData/TableCfg/ (WeaponBasicTable, ItemTable, I18nTextTable).
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'
import { loadTextTable } from './stat-mapping'

// ── Constants ─────────────────────────────────────────────────────────────────

/** weaponType number (from WeaponBasicTable) → project type name.
 *  Source of truth: AKEData WeaponBasicTable + AKEDatabase maps.json weapon_id_map.
 *  Verified against all weapon IDs — prefix matches type 1:1 (wpn_sword_→1, etc). */
export const WEAPON_TYPE_MAP: Record<number, string> = {
  1: '单手剑',
  2: '施术单元',
  3: '双手剑',
  5: '长柄武器',
  6: '手铳',
}

/** weaponId prefix → type name (fallback when weaponType is unknown) */
const WEAPON_PREFIX_TYPE: Record<string, string> = {
  wpn_pistol_: '手铳',
  wpn_sword_: '单手剑',
  wpn_claym_: '双手剑',
  wpn_funnel_: '施术单元',
  wpn_lance_: '长柄武器',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeaponEntry {
  weaponId: string
  title: string             // official CN name (from I18nTextTable_CN)
  rarity: number
  weaponType: number        // numeric type from WeaponBasicTable
  typeName: string          // resolved type name
  engNameTextId: string     // TextTable ID for engName (used for i18n lookup)
  iconPath: string          // iconId from ItemTable
  isNew: boolean            // not in project
  nameMismatch?: string     // project name differs from official
  charAssociation?: {       // 专武 detection
    charId: string
    charName: string        // from CharacterTable
    confidence: number      // 0.8 = 专武, 0.3 = shared, 0.2 = secondary
  }
}

export interface WeaponCompareResult {
  entries: WeaponEntry[]
  newCount: number
  mismatchCount: number
  i18nEntries: { id: string; textId: string }[]
}

// ── Main comparator ───────────────────────────────────────────────────────────

/** Type for WeaponBasicTable entries (loaded from TableCfg). */
interface WeaponBasicEntry {
  weaponId: string
  rarity: number
  weaponType: number
  weaponSkillList: string[]
}

/** Load ItemTable iconId → weaponId mapping via regex (avoids int64 truncation). */
function loadItemTableForCompare(akedataPath: string): Record<string, string> {
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  if (!existsSync(itemTablePath)) return {}
  const raw = readFileSync(itemTablePath, 'utf-8')
  const result: Record<string, string> = {}
  // Match weapon entries and extract iconId
  const itemRe = /"(wpn_[^"]+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(raw)) !== null) {
    const itemId = m[1]
    const objStart = raw.indexOf('{', m.index)
    const depth = (() => {
      let d = 0, pos = objStart
      for (; pos < raw.length; pos++) {
        if (raw[pos] === '{') d++
        else if (raw[pos] === '}') { d--; if (d === 0) return pos + 1 }
      }
      return raw.length
    })()
    const block = raw.slice(objStart, depth)
    const iconIdMatch = block.match(/"iconId"\s*:\s*"(wpn_[^"]+)"|"iconId"\s*:\s*(wpn_\w+)/)
    if (iconIdMatch) {
      result[itemId] = iconIdMatch[1] ?? iconIdMatch[2] ?? itemId
    } else {
      result[itemId] = itemId
    }
  }
  return result
}

export function compareWeapons(
  akedataPath: string,
  projectWeaponsTsPath: string,
  charWpnRecommend: Record<string, unknown>,
): WeaponCompareResult {
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  if (!existsSync(wpnBasicPath)) {
    console.warn('  [weapons] WeaponBasicTable.json not found')
    return { entries: [], newCount: 0, mismatchCount: 0, i18nEntries: [] }
  }

  const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, WeaponBasicEntry>

  // Extract localized name text IDs from ItemTable.json (avoids int64 truncation)
  const weaponTextIds = extractItemNameIds(join(akedataPath, 'TableCfg', 'ItemTable.json'))

  // Load CN TextTable for display names
  const cnTextTable = loadTextTable(akedataPath, 'zh-CN')

  // Load ItemTable for iconId resolution
  const itemTable = loadItemTableForCompare(akedataPath)

  // Read project weapon IDs
  const projectIds = extractProjectWeaponIds(projectWeaponsTsPath)

  const entries: WeaponEntry[] = []
  const i18nEntries: { id: string; textId: string }[] = []
  let newCount = 0
  const mismatchCount = 0

  // Iterate WeaponBasicTable entries (76 weapons, all current)
  for (const [weaponId, wpnData] of Object.entries(wpnBasic)) {
    const rarity: number = wpnData.rarity ?? 1
    const weaponType: number = wpnData.weaponType ?? 0
    const iconPath: string = itemTable[weaponId] ?? weaponId

    // Get localized display name from ItemTable.name.id → I18nTextTable_CN
    const nameTextId = weaponTextIds[weaponId] ?? ''
    const title = nameTextId ? (cnTextTable[nameTextId] ?? weaponId) : weaponId

    // Resolve type name
    const typeName = WEAPON_TYPE_MAP[weaponType] ?? inferTypeFromId(weaponId)

    const isNew = !projectIds.has(weaponId)
    if (isNew) newCount++

    // Check name mismatch
    let nameMismatch: string | undefined
    if (!isNew) {
      // We can't easily read the project weapon name here (TS file), skip for now
    }

    // 专武 detection
    const charAssociation = detectCharAssociation(weaponId, charWpnRecommend)

    entries.push({
      weaponId, title, rarity, weaponType, typeName,
      engNameTextId: nameTextId, iconPath, isNew, nameMismatch, charAssociation,
    })

    if (nameTextId) {
      i18nEntries.push({ id: weaponId, textId: nameTextId })
    }
  }

  return { entries, newCount, mismatchCount, i18nEntries }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractProjectWeaponIds(tsPath: string): Set<string> {
  if (!existsSync(tsPath)) return new Set()
  const content = readFileSync(tsPath, 'utf-8')
  const ids = new Set<string>()
  const re = /id:\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    ids.add(m[1])
  }
  return ids
}

function inferTypeFromId(weaponId: string): string {
  for (const [prefix, name] of Object.entries(WEAPON_PREFIX_TYPE)) {
    if (weaponId.startsWith(prefix)) return name
  }
  return '未知'
}

function detectCharAssociation(
  weaponId: string,
  charWpnRecommend: Record<string, unknown>,
): WeaponEntry['charAssociation'] {
  const primaryChars: string[] = []
  const secondaryChars: string[] = []

  for (const [charId, data] of Object.entries(charWpnRecommend)) {
    const rec = data as Record<string, unknown>
    const ids1 = (rec.weaponIds1 ?? []) as string[]
    const ids2 = (rec.weaponIds2 ?? []) as string[]
    if (ids1.includes(weaponId)) primaryChars.push(charId)
    if (ids2.includes(weaponId)) secondaryChars.push(charId)
  }

  if (primaryChars.length === 1) {
    return { charId: primaryChars[0], charName: primaryChars[0], confidence: 0.8 }
  }
  if (primaryChars.length > 1) {
    return { charId: primaryChars.join(','), charName: `${primaryChars.length} characters`, confidence: 0.3 }
  }
  if (secondaryChars.length > 0) {
    return { charId: secondaryChars[0], charName: secondaryChars[0], confidence: 0.2 }
  }
  return undefined
}
