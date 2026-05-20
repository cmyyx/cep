/**
 * Region / sub-region i18n key mapping.
 * Raw Chinese names (from dungeon data) → i18n key in the `region` namespace.
 *
 * Storage in regionFirst / regionSecond remains raw Chinese (backward-compatible).
 * Only the display layer uses these i18n keys.
 *
 * Source: D:/GitHub/EndFieldTranslationReferrer/i18n/
 */

const REGION_I18N_MAP: Record<string, string> = {
  '四号谷地': 'region.fourthValley',
  '武陵': 'region.wuling',
}

const SUB_REGION_I18N_MAP: Record<string, string> = {
  '枢纽区': 'region.hubZone',
  '源石研究园': 'region.originiumSciencePark',
  '供能高地': 'region.powerPlateau',
  '矿脉源区': 'region.originLodespring',
  '武陵城': 'region.wulingCity',
  '清波寨': 'region.qingboStockade',
  '首墩': 'region.markerStone',
  '试验园区': 'region.testArea',
}

/** Get the i18n key for a region or sub-region raw Chinese name. Falls back to the raw name. */
export function regionI18nKey(rawName: string): string {
  return REGION_I18N_MAP[rawName] ?? SUB_REGION_I18N_MAP[rawName] ?? rawName
}
