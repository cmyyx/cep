'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { wikiTextKey } from '@/lib/wiki-i18n'
import type { WikiEntitySummary, WikiEnumGroup } from '@/types/wiki'

export function useWikiTranslations() {
  const characters = useTranslations('characters')
  const weapons = useTranslations('weapons')
  const equipment = useTranslations('equips')
  const wikiData = useTranslations('wikiData')
  const equipStats = useTranslations('equipStats')

  const entityName = useCallback((entity: WikiEntitySummary): string => {
    if (entity.category === 'characters') return characters.has(entity.id) ? characters(entity.id) : entity.id
    if (entity.category === 'weapons') return weapons.has(entity.id) ? weapons(entity.id) : entity.id
    return equipment.has(entity.id) ? equipment(entity.id) : entity.id
  }, [characters, equipment, weapons])

  const text = useCallback((...segments: Array<string | number>): string => {
    const key = wikiTextKey(...segments)
    if (!wikiData.has(key)) return String(segments.at(-1) ?? key)
    const value = wikiData.raw(key)
    return typeof value === 'string' ? value : String(segments.at(-1) ?? key)
  }, [wikiData])

  const enumLabel = useCallback((group: WikiEnumGroup, id: string) => text('enum', group, id), [text])
  const equipmentStatLabel = useCallback((id: string): string => {
    if (equipStats.has(id)) return equipStats(id)
    return enumLabel('attributes', id)
  }, [enumLabel, equipStats])

  return {
    entityName,
    enumLabel,
    equipmentStatLabel,
    itemName: (itemId: string) => text('item', itemId),
    suitName: (suitId: string) => text('suit', suitId),
    text,
  }
}
