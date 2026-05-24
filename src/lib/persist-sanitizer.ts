/**
 * Generic sanitizer for persisted Zustand store data.
 *
 * Every store's persisted payload is validated on load against the current dataset.
 * Unknown keys and values are silently dropped, so weapon-ID changes and schema
 * evolutions don't require manual migration scripts.
 */

import { weapons } from '@/data/weapons'
import { equips } from '@/data/equips'

// ── Known ID sets ────────────────────────────────────────

const knownWeaponIds: Set<string> = new Set(weapons.map(w => w.id))
const knownEquipIds: Set<string> = new Set(equips.map(e => e.id))

/** Read active custom weapon IDs from the essence-settings persisted store.
 *  This is used to distinguish live custom weapons from deleted ones whose
 *  IDs still start with "custom-". */
export function getActiveCustomWeaponIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem('essence-settings')
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    const state = parsed?.state ?? parsed
    const cw: { id: string }[] = Array.isArray(state?.customWeapons) ? state.customWeapons : []
    return new Set(cw.map(w => w.id))
  } catch {
    return new Set()
  }
}

/** Returns true if the id belongs to a known weapon or a user custom weapon.
 *  NOTE: does NOT verify whether a custom weapon is still active — use
 *  sanitizeWeaponIdArray with activeCustomIds for that. */
export function isValidWeaponId(id: string): boolean {
  return knownWeaponIds.has(id) || id.startsWith('custom-')
}

/** Returns true if the id belongs to a known equip. */
export function isValidEquipId(id: string): boolean {
  return knownEquipIds.has(id)
}

// ── Object sanitizers ────────────────────────────────────

/** Strip entries whose key is not a valid weapon ID from a Record. */
export function sanitizeWeaponIdMap<T>(obj: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {}
  for (const key of Object.keys(obj)) {
    if (isValidWeaponId(key)) result[key] = obj[key]
  }
  return result
}

/** Filter an array to only include valid weapon IDs.
 *  When activeCustomIds is provided, custom-* IDs that are NOT in the active
 *  set (i.e. deleted custom weapons) are silently dropped. */
export function sanitizeWeaponIdArray(
  ids: string[],
  activeCustomIds?: Set<string>,
): string[] {
  return ids.filter(id => {
    if (knownWeaponIds.has(id)) return true
    if (id.startsWith('custom-')) {
      return activeCustomIds ? activeCustomIds.has(id) : true
    }
    return false
  })
}

/** Filter a Weapon[] to only include entries with valid IDs. */
export function sanitizeCustomWeapons<T extends { id: string }>(arr: T[]): T[] {
  return arr.filter(w => isValidWeaponId(w.id))
}

/** Validate an equip ID; return null if unknown. */
export function sanitizeEquipId(id: string | null): string | null {
  if (id === null) return null
  return isValidEquipId(id) ? id : null
}
