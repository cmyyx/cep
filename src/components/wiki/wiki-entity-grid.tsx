'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useBannerStore } from '@/stores/useBannerStore'
import { weapons } from '@/data/weapons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { FilterChip } from '@/components/shared/filter-chip'
import { NavLink } from '@/components/shared/nav-link'
import { withImageCacheVersion } from '@/lib/image-url'
import { useWikiStore } from '@/stores/useWikiStore'
import type {
  LocalizedText,
  WikiEntitySummary,
  WikiEnumGroup,
  WikiEnumLabels,
  WikiEquipmentSummary,
  WikiLocale,
} from '@/types/wiki'
type WikiFilterField =
  | 'rarity'
  | 'elementId'
  | 'professionId'
  | 'weaponTypeId'
  | 'partTypeId'

interface WikiEntityFilter {
  field: WikiFilterField
  labelKey: string
  enumGroup?: WikiEnumGroup
}

interface WikiEntityGridProps {
  entities: WikiEntitySummary[]
  imageBasePath: string
  enums: WikiEnumLabels
  filters?: WikiEntityFilter[]
}

function filterValue(entity: WikiEntitySummary, field: WikiFilterField): string {
  if (field === 'rarity') return String(entity.rarity)
  if (field === 'elementId') return entity.category === 'characters' ? entity.elementId : ''
  if (field === 'professionId') return entity.category === 'characters' ? entity.professionId : ''
  if (field === 'weaponTypeId') {
    return entity.category === 'equipment' ? '' : entity.weaponTypeId
  }
  return entity.category === 'equipment' ? entity.partTypeId : ''
}

const weaponCharacters = new Map(
  weapons
    .filter((weapon) => weapon.id.startsWith('wpn_'))
    .map((weapon) => [weapon.id, weapon.chars])
)

export function sortWikiEntities(entities: WikiEntitySummary[], locale: WikiLocale) {
  return [...entities].sort((left, right) => {
    if (left.rarity !== right.rarity) return right.rarity - left.rarity
    const leftName = left.name[locale] || left.name['zh-CN'] || left.id
    const rightName = right.name[locale] || right.name['zh-CN'] || right.id
    return leftName.localeCompare(rightName, locale)
  })
}

export interface WikiEquipmentGroup {
  key: string
  label: string
  entities: WikiEquipmentSummary[]
}

export function groupWikiEquipmentBySuit(
  entities: WikiEquipmentSummary[],
  locale: WikiLocale,
  noSetLabel = 'No set'
): WikiEquipmentGroup[] {
  const groups = new Map<string, WikiEquipmentSummary[]>()
  for (const entity of entities) {
    const key = entity.suitId ?? '__no-set__'
    const group = groups.get(key) ?? []
    group.push(entity)
    groups.set(key, group)
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: key === '__no-set__'
        ? noSetLabel
        : group[0]?.suitName?.[locale] || group[0]?.suitName?.['zh-CN'] || key,
      entities: [...group].sort((left, right) =>
        right.rarity - left.rarity ||
        left.partTypeId.localeCompare(right.partTypeId) ||
        (left.name[locale] || left.name['zh-CN'] || left.id).localeCompare(right.name[locale] || right.name['zh-CN'] || right.id, locale)
      ),
    }))
    .sort((left, right) =>
      left.key === '__no-set__' ? -1 :
        right.key === '__no-set__' ? 1 :
          (right.entities[0]?.rarity ?? 0) - (left.entities[0]?.rarity ?? 0) || left.label.localeCompare(right.label, locale)
    )
}

export function getWikiEntityUpStatus(
  entity: WikiEntitySummary,
  upNames: ReadonlySet<string>,
  associations: ReadonlyMap<string, string[]> = weaponCharacters
) {
  if (entity.category === 'characters') {
    return upNames.has(entity.name['zh-CN'])
  }
  if (entity.category === 'weapons') {
    return associations.get(entity.id)?.some((name) => upNames.has(name)) ?? false
  }
  return false
}

export const WikiEntityGrid = memo(function WikiEntityGrid({
  entities,
  imageBasePath,
  enums,
  filters = [],
}: WikiEntityGridProps) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({})
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const expandedSuitKeys = useWikiStore((state) => state.expandedEquipmentGroups)
  const toggleSuitExpanded = useWikiStore((state) => state.toggleEquipmentGroup)
  const upCharacterNames = useBannerStore((state) => state.upCharacterNames)
  const refreshBannerStatus = useBannerStore((state) => state.refreshBannerStatus)
  const upNames = useMemo(() => new Set(upCharacterNames), [upCharacterNames])

  useEffect(() => {
    refreshBannerStatus()
    const id = setInterval(refreshBannerStatus, 60_000)
    return () => clearInterval(id)
  }, [refreshBannerStatus])

  const filterValues = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const filter of filters) {
      const values = new Set(
        entities.map((entity) => filterValue(entity, filter.field)).filter(Boolean)
      )
      result[filter.field] = [...values].sort((left, right) => {
        if (filter.field === 'rarity') return Number(right) - Number(left)
        const labels = filter.enumGroup ? enums[filter.enumGroup] : undefined
        return (labels?.[left]?.[locale] ?? left).localeCompare(labels?.[right]?.[locale] ?? right)
      })
    }
    return result
  }, [entities, enums, filters, locale])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale)
    return sortWikiEntities(entities.filter((entity) => {
      const name = entity.name[locale] || entity.name['zh-CN'] || entity.id
      if (term && !name.toLocaleLowerCase(locale).includes(term) && !entity.id.includes(term)) {
        return false
      }
      return Object.entries(activeFilters).every(([field, selected]) => {
        return selected.size === 0 || selected.has(filterValue(entity, field as WikiFilterField))
      })
    }), locale)
  }, [activeFilters, entities, locale, search])

  const toggleFilter = useCallback((field: string, value: string) => {
    setActiveFilters((current) => {
      const selected = new Set(current[field] ?? [])
      if (selected.has(value)) selected.delete(value)
      else selected.add(value)
      return { ...current, [field]: selected }
    })
  }, [])


  const hasActiveFilters = Object.values(activeFilters).some((selected) => selected.size > 0)
  const activeFilterCount = Object.values(activeFilters).reduce((count, selected) => count + selected.size, 0)
  const enumLabel = useCallback(
    (group: WikiEnumGroup | undefined, value: string) => {
      const label: LocalizedText | undefined = group ? enums[group][value] : undefined
      return label?.[locale] || label?.['zh-CN'] || value
    },
    [enums, locale]
  )

  const filteredEquipment = filtered.filter((entity): entity is WikiEquipmentSummary => entity.category === 'equipment')
  const equipmentGroups = useMemo(
    () => filteredEquipment.length > 0 ? groupWikiEquipmentBySuit(filteredEquipment, locale, t('wiki.noSet')) : [],
    [filteredEquipment, locale, t]
  )
  const renderEntity = (entity: WikiEntitySummary) => {
    const imageSrc = withImageCacheVersion(`${imageBasePath}/${entity.imageId}.avif`)
    const displayName = entity.name[locale] || entity.name['zh-CN'] || entity.id
    const isUp = getWikiEntityUpStatus(entity, upNames)
    return (
      <NavLink
        key={entity.id}
        href={`/${locale}/wiki/${entity.category}/${entity.id}`}
        loadingLabel={displayName}
        className="min-w-0 overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)] outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <RarityFrame
          imageSrc={imageSrc}
          backgroundSrc={entity.category === 'characters' ? '/images/character-frame-bg.png' : undefined}
          title={displayName}
          rarity={entity.rarity}
          imageClassName="object-contain p-3"
          badges={isUp ? <Image src="/up.png" alt="UP" width={132} height={60} className="h-auto w-11 object-contain" unoptimized /> : undefined}
          className="rounded-none shadow-none"
        />
      </NavLink>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <Input
            aria-label={t('wiki.searchPlaceholder')}
            placeholder={t('wiki.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full"
          />
          <span className="font-geist-mono text-xs text-muted-foreground">
            {t('wiki.resultCount', { count: filtered.length })}
          </span>
        </div>
        {filters.length > 0 && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              aria-expanded={filterPanelOpen}
              onClick={() => setFilterPanelOpen((open) => !open)}
              className="min-h-10 w-full justify-start gap-2 px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={filterPanelOpen ? 'transition-transform' : '-rotate-90 transition-transform'} />
              <span>{t('wiki.filterToggle')}</span>
              {activeFilterCount > 0 && <Badge variant="secondary" className="ml-auto">{activeFilterCount}</Badge>}
            </Button>
            {filterPanelOpen && (
              <div className="space-y-3 rounded-lg bg-muted/30 p-3 shadow-[var(--shadow-border)]">
                {filters.map((filter) => (
                  <div key={filter.field} className="grid min-w-0 gap-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
                    <span className="pt-1 text-xs font-medium text-muted-foreground">{t(filter.labelKey)}</span>
                    <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-1.5">
                      {filterValues[filter.field]?.map((value) => (
                        <FilterChip
                          key={value}
                          value={value}
                          label={filter.field === 'rarity' ? `${value}★` : enumLabel(filter.enumGroup, value)}
                          isValid
                          isSelected={activeFilters[filter.field]?.has(value) ?? false}
                          onToggle={() => toggleFilter(filter.field, value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {hasActiveFilters && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setActiveFilters({})}>
                    {t('wiki.clearFilters')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {search.trim() || hasActiveFilters ? t('wiki.noMatch') : t('wiki.noData')}
          </p>
        ) : equipmentGroups.length > 0 ? (
          <div className="space-y-2">
            {equipmentGroups.map((group) => {
              const expanded = expandedSuitKeys.includes(group.key)
              return (
                <section key={group.key} className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-expanded={expanded}
                    onClick={() => toggleSuitExpanded(group.key)}
                    className="min-h-10 w-full justify-start gap-2 px-3"
                  >
                    <ChevronDown className={expanded ? 'transition-transform' : '-rotate-90 transition-transform'} />
                    <span className="min-w-0 flex-1 truncate text-left font-medium">{group.label}</span>
                    <Badge variant="secondary">{group.entities.length}</Badge>
                  </Button>
                  {expanded && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 p-3 pt-1 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]">
                      {group.entities.map(renderEntity)}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
            {filtered.map(renderEntity)}
          </div>
        )}
      </div>
    </div>
  )
})
