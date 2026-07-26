'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { useGameI18nLocale } from '@/hooks/use-game-i18n-catalogs'
import { asWikiLocale } from '@/lib/wiki-locale'
import { wikiTextKey } from '@/lib/wiki-i18n'
import { entityDisplayName } from '@/lib/wiki-summary-locale'
import type { WikiEntitySummary, WikiEnumGroup } from '@/types/wiki'

/**
 * Wiki / planner entity labels resolved from generated catalogs (per-locale chunks).
 * Does not read wikiData from NextIntlClientProvider — that would re-embed ~0.9MB
 * into every static page under the root layout.
 */
export function useWikiTranslations() {
  const locale = asWikiLocale(useLocale())
  const catalogs = useGameI18nLocale(locale)

  const entityName = useCallback((entity: WikiEntitySummary | { id: string; category: string; name?: string | Record<string, string> }): string => {
    // Prefer the name embedded in the summary — either already localized
    // (static export slim payloads) or a full LocalizedText record indexed by
    // the current locale. This keeps labels independent of the async catalog
    // chunk, so pickers never flash raw ids like `chr_9000_endmin`.
    if (entity.name) {
      const embedded = entityDisplayName({ name: entity.name, id: entity.id }, locale)
      if (embedded && embedded !== entity.id) return embedded
    }
    if (entity.category === 'characters') {
      return catalogs?.characters[entity.id] ?? entity.id
    }
    if (entity.category === 'weapons') {
      return catalogs?.weapons[entity.id] ?? entity.id
    }
    return catalogs?.equips[entity.id] ?? entity.id
  }, [catalogs, locale])

  const text = useCallback((...segments: Array<string | number>): string => {
    const key = wikiTextKey(...segments)
    return catalogs?.wikiData[key] ?? String(segments.at(-1) ?? key)
  }, [catalogs])

  const enumLabel = useCallback(
    (group: WikiEnumGroup, id: string) => text('enum', group, id),
    [text],
  )

  const equipmentStatLabel = useCallback((id: string): string => {
    if (catalogs?.equipStats[id]) return catalogs.equipStats[id]
    return enumLabel('attributes', id)
  }, [catalogs, enumLabel])

  return {
    entityName,
    enumLabel,
    equipmentStatLabel,
    itemName: (itemId: string) => text('item', itemId),
    suitName: (suitId: string) => text('suit', suitId),
    text,
    /** True once the locale catalog chunk has loaded. */
    ready: catalogs != null,
  }
}
