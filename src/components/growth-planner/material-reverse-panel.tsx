'use client'

import { useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Search } from 'lucide-react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ItemFrameBackground } from '@/components/shared/item-frame-background'
import { PLANNER_SELECTED_BADGE_CLASS, PLANNER_SELECTED_RING_CLASS } from '@/lib/planner-selection-styles'
import { withImageCacheVersion } from '@/lib/image-url'
import { getRarityBandSrc, getRarityColorClass } from '@/components/shared/rarity-stars'
import { getPlannerGameData, getWikiCharacterSummaries, getWikiWeaponSummaries } from '@/lib/planner/planner-data-loader'
import { getMaterialIndex } from '@/lib/planner/material-index'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { cn } from '@/lib/utils'
import type { WikiEntitySummary } from '@/types/wiki'
/**
 * Reverse material lookup for the growth planner.
 *
 * Pick a material (or gold / EXP card) and see which operators/weapons
 * consume it at full max-level-up ("升满") and how much. Cards follow the
 * essence-planner weapon-card visual language: square tile, art filling the
 * tile, name overlaid at the bottom, rarity band, and a corner badge for the
 * required quantity.
 */
export function MaterialReversePanel() {
  const t = useTranslations('growthPlanner')
  const locale = useLocale()
  const { itemName, entityName } = useWikiTranslations()
  // Rendered behind the page's usePlannerData() gate, so the cache is populated.
  const plannerGameData = getPlannerGameData()
  const wikiCharacters = getWikiCharacterSummaries()
  const wikiWeapons = getWikiWeaponSummaries()
  const index = useMemo(() => getMaterialIndex(), [])
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale])

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const materials = useMemo(() => {
    const list = [...index.keys()]
    // Rarity desc, then stable id order.
    list.sort((a, b) => {
      const rarityA = plannerGameData.materials[a]?.rarity ?? 1
      const rarityB = plannerGameData.materials[b]?.rarity ?? 1
      if (rarityB !== rarityA) return rarityB - rarityA
      return a.localeCompare(b)
    })
    const query = searchQuery.trim().toLowerCase()
    if (!query) return list
    return list.filter((itemId) => itemId.toLowerCase().includes(query) || itemName(itemId).toLowerCase().includes(query))
  }, [index, searchQuery, itemName, plannerGameData])

  // Fall back to the first material when the selected one disappears from the
  // filtered list (search narrowed it away).
  const effectiveSelected = selectedItemId && materials.includes(selectedItemId) ? selectedItemId : null
  const summaryFor = useCallback(
    (id: string): WikiEntitySummary | undefined =>
      wikiCharacters.find((entry) => entry.id === id) ?? wikiWeapons.find((entry) => entry.id === id),
    [wikiCharacters, wikiWeapons],
  )

  const consumers = useMemo(() => {
    if (!effectiveSelected) return []
    // Sort like the essence-planner weapon list: consumption desc, then
    // rarity desc, then name asc.
    return [...(index.get(effectiveSelected) ?? [])].sort((a, b) => {
      const countDiff = b.count - a.count
      if (countDiff !== 0) return countDiff
      const rarityA = summaryFor(a.id)?.rarity ?? 0
      const rarityB = summaryFor(b.id)?.rarity ?? 0
      if (rarityB !== rarityA) return rarityB - rarityA
      const nameA = summaryFor(a.id) ? entityName(summaryFor(a.id)!) : a.id
      const nameB = summaryFor(b.id) ? entityName(summaryFor(b.id)!) : b.id
      return nameA.localeCompare(nameB, locale)
    })
  }, [index, effectiveSelected, locale, entityName, summaryFor])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('materialSearch')}
            className="pl-8"
            aria-label={t('materialSearch')}
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{t('maxConsumptionHint')}</span>
      </div>

      {/* Material picker — weapon-card style tiles */}
      <div className="max-h-64 overflow-y-auto rounded-xl bg-muted/35 p-3 shadow-[var(--shadow-border)]">
        {materials.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noMaterialMatch')}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
            {materials.map((itemId) => {
              const material = plannerGameData.materials[itemId]
              const icon = `/images/items/${material?.iconId ?? itemId}.avif`
              const isSelected = itemId === effectiveSelected
              return (
                <Button
                  key={itemId}
                  type="button"
                  variant="ghost"
                  size="card"
                  onClick={() => setSelectedItemId(itemId)}
                  aria-pressed={isSelected}
                  data-item-id={itemId}
                  className={cn(
                    'relative aspect-square w-full overflow-hidden rounded-lg border',
                    isSelected ? cn('border-amber-400', PLANNER_SELECTED_RING_CLASS) : 'border-border hover:ring-2 hover:ring-white/40',
                  )}
                >
                  <ItemFrameBackground />
                  <Image
                    src={withImageCacheVersion(icon)}
                    alt={itemName(itemId)}
                    fill
                    className="z-10 object-contain p-2"
                    unoptimized
                    loading="lazy"
                  />
                  <Image
                    src={getRarityBandSrc(material?.rarity)}
                    alt=""
                    width={200}
                    height={40}
                    className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
                    unoptimized
                  />
                  <span className={cn('absolute inset-x-1 bottom-1.5 z-30 truncate px-1 text-[11px] leading-tight font-semibold drop-shadow-md', getRarityColorClass(material?.rarity))}>
                    {itemName(itemId)}
                  </span>
                  {isSelected && (
                    <span className={cn('absolute top-1.5 right-1.5 z-30 flex size-5 items-center justify-center rounded-full shadow-md', PLANNER_SELECTED_BADGE_CLASS)}>
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        )}
      </div>

      {/* Consumers — same tile style with a quantity corner badge */}
      {effectiveSelected ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{t('consumers')}</h3>
            <Badge variant="secondary">{consumers.length}</Badge>
          </div>
          {consumers.length === 0 ? (
            <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">{t('consumersEmpty')}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
              {consumers.map((entry) => {
                const summary = summaryFor(entry.id)
                if (!summary) return null
                const name = entityName(summary)
                const imageSrc = `${entry.kind === 'character' ? '/images/characters' : '/images/weapon'}/${summary.imageId}.avif`
                return (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-border)]"
                  >
                    <ItemFrameBackground />
                    <Image
                      src={withImageCacheVersion(imageSrc)}
                      alt={name}
                      fill
                      className={cn('z-10', entry.kind === 'weapon' ? 'object-contain p-2' : 'object-cover')}
                      unoptimized
                      loading="lazy"
                    />
                    <Image
                      src={getRarityBandSrc(summary.rarity)}
                      alt=""
                      width={200}
                      height={40}
                      className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
                      unoptimized
                    />
                    <span className={cn('absolute inset-x-1 bottom-1.5 z-30 truncate px-1 text-[11px] leading-tight font-semibold drop-shadow-md', getRarityColorClass(summary.rarity))}>
                      {name}
                    </span>
                    {/* Quantity corner badge — amber like the essence-planner
                        selection badge: characters/weapons art is dark, so a
                        black badge would blend into the tile background. */}
                    <span className="absolute top-1.5 right-1.5 z-30 rounded-full bg-amber-400 px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-stone-900 shadow-md">
                      {number.format(entry.count)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="flex items-center justify-center rounded-xl bg-muted/35 px-8 py-12 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          {t('materialSelectHint')}
        </div>
      )}
    </div>
  )
}
