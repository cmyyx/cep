import type { WeaponAcquisitionSource } from '@/types/weapon-acquisition'

/**
 * Display order for acquisition categories (wiki detail groups, card footers).
 * Categories not listed keep their data order at the end.
 */
export const ACQUISITION_CATEGORY_ORDER: readonly string[] = [
  'gacha',
  'shop',
  'activity',
  'battlePass',
  'explore',
  'chest',
]

/** Distinct category ids of a weapon's acquisition sources, display-ordered. */
export function acquisitionCategoryIds(sources: readonly WeaponAcquisitionSource[] | undefined): string[] {
  const ids = [...new Set((sources ?? []).map((source) => source.categoryId))]
  return ids.sort((a, b) => {
    const indexA = ACQUISITION_CATEGORY_ORDER.indexOf(a)
    const indexB = ACQUISITION_CATEGORY_ORDER.indexOf(b)
    if (indexA === -1 && indexB === -1) return 0
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
}

/**
 * Hide-filter test for the "hide acquisition category" settings.
 * Weapons without acquisition data (custom and preview weapons) carry no
 * category and are therefore never hidden by this filter — the "unknown"
 * state is a display fallback only and must not be hideable.
 */
export function isHiddenByAcquisitionCategory(
  sources: readonly WeaponAcquisitionSource[] | undefined,
  hiddenCategoryIds: readonly string[],
): boolean {
  if (hiddenCategoryIds.length === 0) return false
  const categories = acquisitionCategoryIds(sources)
  if (categories.length === 0) return false
  return categories.some((categoryId) => hiddenCategoryIds.includes(categoryId))
}

/** next-intl translator shape: maps a key to text and reports key existence. */
type IntlTranslator = ((key: string) => string) & { has: (key: string) => boolean }

/**
 * Localized acquisition category label: generated wikiData catalog first,
 * then the static messages fallback, then the raw category id.
 * Shared by weapon/dungeon cards and the panel preview config.
 */
export function acquisitionCategoryLabelText(
  categoryId: string,
  wikiText: (namespace: string, key: string) => string,
  t: IntlTranslator,
): string {
  const translated = wikiText('acquisitionCategory', categoryId)
  if (translated !== categoryId) return translated
  const fallbackKey = `essenceSettings.acquisitionCategory.${categoryId}`
  return t.has(fallbackKey) ? t(fallbackKey) : categoryId
}
