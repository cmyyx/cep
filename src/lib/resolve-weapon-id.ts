import { weapons as staticWeapons } from '@/data/weapons'

/**
 * Name → current game ID map derived from the canonical weapons.ts.
 * Rebuilt on every module load (e.g. HMR in dev, new build in prod),
 * so it always reflects the current build's weapon data — no migration
 * table or dead files needed.
 *
 * When a preview weapon is released:
 *   1. Change `id` from "preview:雾中微光" to "wpn_funnel_0017" in weapons.ts.
 *   2. The map rebuilds, "雾中微光" → "wpn_funnel_0017".
 *   3. On next page load, resolveWeaponId("preview:雾中微光") → "wpn_funnel_0017".
 *   4. Zustand persist writes back the resolved game ID — localStorage is clean.
 */
const nameToId = new Map(staticWeapons.map((w) => [w.name, w.id]))

/**
 * Resolve a weapon ID to its current game client ID.
 *
 * - Normal IDs (wpn_sword_0022) pass through unchanged.
 * - Preview IDs (preview:武器名) are looked up by name in the current
 *   weapons.ts. If the weapon has been released and its ID updated,
 *   the game ID is returned. If still in preview, the preview ID
 *   itself is returned unchanged.
 */
export function resolveWeaponId(id: string): string {
  if (!id.startsWith('preview:')) return id
  const name = id.slice('preview:'.length)
  return nameToId.get(name) ?? id
}

/**
 * Resolve weapon IDs in a dungeonS1Selections structure
 * (Record<planKey, weaponId[]>). Returns a new object with all
 * weapon IDs resolved from preview: to their current game IDs.
 */
export function resolveS1Selections(
  s1: Record<string, string[]>,
): Record<string, string[]> {
  if (!s1 || typeof s1 !== 'object') return {}
  const result = Object.create(null) as Record<string, string[]>
  for (const [key, ids] of Object.entries(s1)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    if (Array.isArray(ids)) {
      result[key] = ids.map((id) => (typeof id === 'string' ? resolveWeaponId(id) : id)).filter((v): v is string => typeof v === 'string')
    }
  }
  return result
}

export function resolveWeaponIdKeys<V>(record: Record<string, V>): Record<string, V> {
  let needsResolve = false
  for (const key of Object.keys(record)) {
    if (key.startsWith('preview:')) {
      needsResolve = true
      break
    }
  }
  if (!needsResolve) return record

  // Use null-prototype object to guard against prototype pollution
  // from keys like "__proto__", "constructor", "prototype".
  const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
  const result = Object.create(null) as Record<string, V>
  for (const [key, value] of Object.entries(record)) {
    const outKey = resolveWeaponId(key)
    if (PROTOTYPE_KEYS.has(outKey)) continue
    result[outKey] = value
  }
  return result
}
