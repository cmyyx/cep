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
 * Resolve all keys in a Record that may contain preview-IDs.
 * If multiple preview keys resolve to the same game ID, last one wins.
 */
export function resolveWeaponIdKeys<V>(record: Record<string, V>): Record<string, V> {
  let needsResolve = false
  for (const key of Object.keys(record)) {
    if (key.startsWith('preview:')) {
      needsResolve = true
      break
    }
  }
  if (!needsResolve) return record

  const result: Record<string, V> = {}
  for (const [key, value] of Object.entries(record)) {
    result[resolveWeaponId(key)] = value
  }
  return result
}
