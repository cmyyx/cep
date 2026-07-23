'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { hasGameI18n, lookupGameI18n } from '@/lib/game-i18n-catalogs'
import { wikiTextKey } from '@/lib/wiki-i18n'
import type { WikiEntitySummary, WikiEnumGroup, WikiLocale } from '@/types/wiki'

function asWikiLocale(locale: string): WikiLocale {
  if (locale === 'en' || locale === 'ja' || locale === 'zh-CN' || locale === 'zh-TW') {
    return locale
  }
  return 'zh-CN'
}

/**
 * Wiki / planner entity labels resolved from generated catalogs (shared JS chunks).
 * Does not read wikiData from NextIntlClientProvider — that would re-embed ~0.9MB
 * into every static page under the root layout.
 */
export function useWikiTranslations() {
  const locale = asWikiLocale(useLocale())

  const entityName = useCallback((entity: WikiEntitySummary): string => {
    if (entity.category === 'characters') {
      return lookupGameI18n(locale, 'characters', entity.id) ?? entity.id
    }
    if (entity.category === 'weapons') {
      return lookupGameI18n(locale, 'weapons', entity.id) ?? entity.id
    }
    return lookupGameI18n(locale, 'equips', entity.id) ?? entity.id
  }, [locale])

  const text = useCallback((...segments: Array<string | number>): string => {
    const key = wikiTextKey(...segments)
    return lookupGameI18n(locale, 'wikiData', key) ?? String(segments.at(-1) ?? key)
  }, [locale])

  const enumLabel = useCallback(
    (group: WikiEnumGroup, id: string) => text('enum', group, id),
    [text],
  )

  const equipmentStatLabel = useCallback((id: string): string => {
    if (hasGameI18n(locale, 'equipStats', id)) {
      return lookupGameI18n(locale, 'equipStats', id) ?? id
    }
    return enumLabel('attributes', id)
  }, [enumLabel, locale])

  return {
    entityName,
    enumLabel,
    equipmentStatLabel,
    itemName: (itemId: string) => text('item', itemId),
    suitName: (suitId: string) => text('suit', suitId),
    text,
  }
}
