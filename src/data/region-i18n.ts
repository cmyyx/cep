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

const REGION_KEY_MAP: Record<string, string> = {
  '四号谷地': 'fourthValley',
  '武陵': 'wuling',
}

const SUB_REGION_KEY_MAP: Record<string, string> = {
  '枢纽区': 'theHub',
  '源石研究园': 'originiumSciencePark',
  '供能高地': 'powerPlateau',
  '矿脉源区': 'originLodespring',
  '武陵城': 'wulingCity',
  '清波寨': 'qingboStockade',
  '首墩': 'markerStone',
  '试验园区': 'testArea',
}

/** Get the i18n key for a region or sub-region raw Chinese name. Falls back to the raw name. */
export function regionI18nKey(rawName: string): string {
  const key = REGION_KEY_MAP[rawName] ?? SUB_REGION_KEY_MAP[rawName]
  return key ? `region.${key}` : `region.${rawName}`
}
