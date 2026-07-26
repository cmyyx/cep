/**
 * Region / sub-region filtering for the essence planner plan list.
 *
 * The store keeps sub-region selections in ONE flat list, but the UI semantics are
 * per-region: a region with no explicit sub-region selection means "all of its
 * sub-regions" (that is what the per-region "全部" chip restores). Testing a plan
 * against the flat list directly would hide every plan of the other selected
 * regions as soon as one sub-region of one region is picked.
 */

export interface RegionFilterSelection {
  /** Selected regions. Empty = every region passes. */
  selectedRegions: ReadonlySet<string>
  /** Selected sub-regions across all regions (flat, as persisted). */
  selectedSubRegions: ReadonlySet<string>
  /** region -> its sub-regions, used to scope the flat selection per region. */
  subRegionsByRegion: ReadonlyMap<string, readonly string[]>
}

/** Whether a dungeon's region/sub-region pair passes the active filter. */
export function isDungeonInRegionFilter(
  region: string,
  subRegion: string,
  { selectedRegions, selectedSubRegions, subRegionsByRegion }: RegionFilterSelection,
): boolean {
  if (selectedRegions.size > 0 && !selectedRegions.has(region)) return false
  if (selectedSubRegions.size === 0) return true

  const subs = subRegionsByRegion.get(region)
  if (!subs || subs.length === 0) return true

  // No sub-region picked inside this region → the whole region stays visible.
  const scoped = subs.filter((sub) => selectedSubRegions.has(sub))
  if (scoped.length === 0) return true

  return scoped.includes(subRegion)
}

/**
 * Join names with the reader's locale conventions (zh "、…和", en ", … and", …)
 * instead of a hardcoded Chinese separator.
 */
export function formatNameList(names: readonly string[], locale: string): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
  } catch {
    return names.join(', ')
  }
}
