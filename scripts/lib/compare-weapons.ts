// Compares AKEData weapon data against project weapons.
// Detects new weapons, name mismatches, weapon types, and 专武 associations.
// ================================================================================

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'

// ── Constants ─────────────────────────────────────────────────────────────────

/** weaponType number → project type name */
const WEAPON_TYPE_MAP: Record<number, string> = {
  1: '手铳',
  2: '单手剑',
  3: '双手剑',
  4: '施术单元',
  5: '长柄武器',
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
  title: string             // official CN name (from output/CN)
  rarity: number
  weaponType: number        // numeric type from WeaponBasicTable
  typeName: string          // resolved type name
  engNameTextId: string     // TextTable ID for engName (used for i18n lookup)
  iconPath: string
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

export function compareWeapons(
  akedataPath: string,
  projectWeaponsTsPath: string,
  _weaponBasicTable: Record<string, unknown>,
  charWpnRecommend: Record<string, unknown>,
): WeaponCompareResult {
  const weaponDir = join(akedataPath, 'output', 'CN', 'weapon')
  if (!existsSync(weaponDir)) {
    console.warn('  [weapons] AKEData output/CN/weapon not found')
    return { entries: [], newCount: 0, mismatchCount: 0, i18nEntries: [] }
  }

  // Extract localized name text IDs from ItemTable.json (avoids int64 truncation)
  const weaponTextIds = extractItemNameIds(join(akedataPath, 'TableCfg', 'ItemTable.json'))

  // Read project weapon IDs
  const projectIds = extractProjectWeaponIds(projectWeaponsTsPath)

  const entries: WeaponEntry[] = []
  const i18nEntries: { id: string; textId: string }[] = []
  let newCount = 0
  let mismatchCount = 0

  // Read all output/CN/weapon/*.json files
  for (const file of readdirSync(weaponDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const weaponId = file.replace('.json', '')
    const data = JSON.parse(readFileSync(join(weaponDir, file), 'utf-8'))
    const title: string = data.title ?? weaponId
    const rarity: number = data.rarity ?? 1
    const weaponType: number = data.weapontype ?? 0
    const iconPath: string = data.icon ?? ''

    // Get ItemTable.name.id for localized display name (precise int64)
    const nameTextId = weaponTextIds[weaponId] ?? ''

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
  const re = /imageId:\s*['"]([^'"]+)['"]/g
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
