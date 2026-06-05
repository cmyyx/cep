/**
 * Region / sub-region i18n key mapping.
 * Raw Chinese names (from dungeon data) → i18n key in the `region` namespace.
 *
 * Storage in regionFirst / regionSecond remains raw Chinese (backward-compatible).
 * Only the display layer uses these i18n keys.
 *
 * Auto-generated from upstream WorldEnergyPointTable by sync-game-data.
 * Keys match the generated src/generated/i18n/regions/*.json files.
 */

// Import generated region i18n data to build reverse mapping
import regionZhCn from '@/generated/i18n/regions/zh-CN.json'

// Build reverse mapping: Chinese name → i18n key
const REVERSE_MAP: Record<string, string> = {}
for (const [key, cnName] of Object.entries(regionZhCn)) {
  if (typeof cnName === 'string') {
    if (REVERSE_MAP[cnName] !== undefined && REVERSE_MAP[cnName] !== key) {
      console.warn(
        `[region-i18n] Duplicate CN name "${cnName}": existing key "${REVERSE_MAP[cnName]}", new key "${key}" — overwriting`,
      )
    }
    REVERSE_MAP[cnName] = key
  }
}

/** Get the i18n key for a region or sub-region raw Chinese name. Falls back to the raw name. */
export function regionI18nKey(rawName: string): string {
  const key = REVERSE_MAP[rawName]
  return key ? `region.${key}` : `region.${rawName}`
}
