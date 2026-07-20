// Extracts int64 IDs from raw JSON text, preserving precision.
// JavaScript JSON.parse truncates integers > 2^53, so we must use regex.
// All game data text IDs are int64 values that exceed Number.MAX_SAFE_INTEGER.
// ================================================================================

import { readFileSync, existsSync } from 'node:fs'

/**
 * Extract all name.id -> itemId mappings from ItemTable.json.
 * The game stores localized display names in ItemTable[itemId].name.id,
 * which is a TextTable key that resolves to the correct translation per locale.
 *
 * Returns a map of itemId (string) -> name text ID (string).
 */
export function extractItemNameIds(
  filePath: string,
  prefixes?: string[],
): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const raw = readFileSync(filePath, 'utf-8')
  const result: Record<string, string> = {}
  // Default: only weapon and equip prefixes (backward-compatible)
  const allowedPrefixes = prefixes ?? ['wpn_', 'item_equip_']

  const itemRe = /"(\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(raw)) !== null) {
    const itemId = m[1]
    if (!allowedPrefixes.some((p) => itemId.startsWith(p))) continue

    const windowStart = m.index
    const window = raw.substring(windowStart, windowStart + 3000)
    const nameMatch = window.match(/"name"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)
    if (nameMatch?.[1]) {
      result[itemId] = nameMatch[1]
    }
  }

  return result
}

/**
 * Extract all engName.id -> weaponId mappings from WeaponBasicTable.json.
 * Deprecated in favor of extractItemNameIds for display names.
 */
export function extractWeaponTextIds(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const raw = readFileSync(filePath, 'utf-8')
  const result: Record<string, string> = {}

  const weaponRe = /"(\w+)"\s*:\s*\{[^}]*?"engName"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/g
  let m: RegExpExecArray | null
  while ((m = weaponRe.exec(raw)) !== null) {
    const weaponId = m[1]
    const textId = m[2]
    if (weaponId.startsWith('wpn_')) {
      result[weaponId] = textId
    }
  }

  return result
}

// --- Energy Point / Gem extraction (all preserve int64) ---

export function extractEnergyPointGroupNames(filePath: string): Record<string, { nameTextId: string }> {
  if (!existsSync(filePath)) return {}
  const raw = readFileSync(filePath, 'utf-8')
  const result: Record<string, { nameTextId: string }> = {}

  const groupRe = /"(world_energy_point_group\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = groupRe.exec(raw)) !== null) {
    const groupId = m[1]
    const window = raw.substring(m.index, m.index + 3000)
    const nameMatch = window.match(/"gameGroupName"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)
    if (nameMatch?.[1]) {
      result[groupId] = { nameTextId: nameMatch[1] }
    }
  }
  return result
}

export function extractEnergyPointLevel1Names(filePath: string): Record<string, { nameTextId: string }> {
  if (!existsSync(filePath)) return {}
  const raw = readFileSync(filePath, 'utf-8')
  const result: Record<string, { nameTextId: string }> = {}

  const levelRe = /"(world_energy_point\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = levelRe.exec(raw)) !== null) {
    const window = raw.substring(m.index, m.index + 3000)
    const wlMatch = window.match(/"worldLevel"\s*:\s*(\d+)/)
    if (!wlMatch || wlMatch[1] !== '1') continue

    const groupMatch = window.match(/"gameGroupId"\s*:\s*"(world_energy_point_group\w+)"/)
    const nameMatch = window.match(/"gameName"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)

    if (groupMatch?.[1] && nameMatch?.[1]) {
      result[groupMatch[1]] = { nameTextId: nameMatch[1] }
    }
  }
  return result
}

export function extractGemTermTextIds(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const raw = readFileSync(filePath, 'utf-8')
  const result: Record<string, string> = {}

  const gemRe = /"(g[as]t_\w+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = gemRe.exec(raw)) !== null) {
    const gemTermId = m[1]
    const window = raw.substring(m.index, m.index + 2000)
    const tagNameMatch = window.match(/"tagName"\s*:\s*\{[^}]*?"id"\s*:\s*(-?\d+)/)
    if (tagNameMatch?.[1] && tagNameMatch[1] !== '0') {
      result[gemTermId] = tagNameMatch[1]
    }
  }
  return result
}
