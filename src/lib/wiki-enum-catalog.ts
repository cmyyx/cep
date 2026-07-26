import wikiEnums from '@/generated/data/wiki/enums.json'
import type { WikiEnumGroup, WikiLocale } from '@/types/wiki'

type EnumTable = Record<string, Partial<Record<WikiLocale, string>>>

const enumTables = wikiEnums as Record<string, EnumTable>

export interface WikiEnumCatalog {
  /** group → { enum id → localized label } */
  labels: Partial<Record<WikiEnumGroup, Record<string, string>>>
  /** group → canonical enum id order (generated JSON key order) */
  order: Partial<Record<WikiEnumGroup, readonly string[]>>
}

/** Canonical enum id order as emitted by the data generator. */
export function wikiEnumIds(group: WikiEnumGroup): string[] {
  return Object.keys(enumTables[group] ?? {})
}

/**
 * Build the label + order tables a wiki list page hands to WikiEntityGrid, so the
 * static HTML already carries localized enum labels in the canonical game order
 * instead of raw numeric ids resolved later by the client catalog chunk.
 */
export function buildWikiEnumCatalog(
  groups: readonly WikiEnumGroup[],
  translate: (group: WikiEnumGroup, id: string) => string,
): WikiEnumCatalog {
  const labels: Partial<Record<WikiEnumGroup, Record<string, string>>> = {}
  const order: Partial<Record<WikiEnumGroup, readonly string[]>> = {}
  for (const group of groups) {
    const ids = wikiEnumIds(group)
    order[group] = ids
    labels[group] = Object.fromEntries(ids.map((id) => [id, translate(group, id)]))
  }
  return { labels, order }
}
