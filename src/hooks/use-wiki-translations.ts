'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { useGameI18nLocale } from '@/hooks/use-game-i18n-catalogs'
import { asWikiLocale } from '@/lib/wiki-locale'
import { wikiTextKey } from '@/lib/wiki-i18n'
import type { WikiEntitySummary, WikiEnumGroup } from '@/types/wiki'

/**
 * Wiki / planner entity labels resolved from generated catalogs (per-locale chunks).
 * Does not read wikiData from NextIntlClientProvider — that would re-embed ~0.9MB
 * into every static page under the root layout.
 */
export function useWikiTranslations() {
  const locale = asWikiLocale(useLocale())
  const catalogs = useGameI18nLocale(locale)

  const entityName = useCallback((entity: WikiEntitySummary): string => {
    if (entity.category === 'characters') {
      return catalogs?.characters[entity.id] ?? entity.id
    }
    if (entity.category === 'weapons') {
      return catalogs?.weapons[entity.id] ?? entity.id
    }
    return catalogs?.equips[entity.id] ?? entity.id
  }, [catalogs])

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
