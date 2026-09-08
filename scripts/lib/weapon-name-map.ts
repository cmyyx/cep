import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'
import { loadTextTable } from './stat-mapping'

export interface WeaponNameMapResult {
  nameMap: Map<string, string>
  /** Titles carried by more than one upstream weapon — never migratable. */
  ambiguousNames: Set<string>
}

/**
 * Build weapon name → weaponId mapping from TableCfg (WeaponBasicTable +
 * ItemTable + I18nTextTable_CN). Names carried by more than one upstream
 * weapon are dropped from the map and reported as ambiguous so preview
 * migration can never pick the wrong target.
 */
export function buildWeaponNameMap(akedataPath: string): WeaponNameMapResult {
  const nameMap = new Map<string, string>()
  const ambiguousNames = new Set<string>()

  // Load WeaponBasicTable for weapon list
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  if (!existsSync(wpnBasicPath)) return { nameMap, ambiguousNames }
  const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, unknown>

  // Load ItemTable name text IDs
  const weaponTextIds = extractItemNameIds(join(akedataPath, 'TableCfg', 'ItemTable.json'))

  // Load CN TextTable for display names
  const cnTextTable = loadTextTable(akedataPath, 'zh-CN')

  for (const weaponId of Object.keys(wpnBasic)) {
    const nameTextId = weaponTextIds[weaponId]
    const title = nameTextId ? (cnTextTable[nameTextId] ?? weaponId) : weaponId
    if (!title) continue
    // A title marked ambiguous stays ambiguous — a third duplicate would
    // otherwise re-add the deleted entry to the map.
    if (ambiguousNames.has(title)) continue
    const existing = nameMap.get(title)
    if (existing !== undefined && existing !== weaponId) {
      ambiguousNames.add(title)
      nameMap.delete(title)
      continue
    }
    nameMap.set(title, weaponId)
  }

  return { nameMap, ambiguousNames }
}
