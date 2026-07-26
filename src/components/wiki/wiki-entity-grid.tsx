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
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { useWikiStore } from '@/stores/useWikiStore'
import type {
  WikiEntitySummary,
  WikiEnumGroup,
  WikiEquipmentSummary,
  WikiLocale,
} from '@/types/wiki'
import {
  entityDisplayName,
  entityNameZhCN,
  equipmentModelKeyFromZhCN,
  type LocalizedWikiEntitySummary,
} from '@/lib/wiki-summary-locale'
type WikiFilterField =
  | 'rarity'
  | 'elementId'
  | 'professionId'
  | 'weaponTypeId'
  | 'partTypeId'

type WikiGroupField = 'elementId' | 'weaponTypeId'

interface WikiEntityFilter {
  field: WikiFilterField
  labelKey: string
  enumGroup?: WikiEnumGroup
}

interface WikiEntityGroupConfig {
  field: WikiGroupField
  enumGroup: WikiEnumGroup
}

type GridEntity = WikiEntitySummary | LocalizedWikiEntitySummary

interface WikiEntityGridProps {
  entities: GridEntity[]
  imageBasePath: string
  filters?: WikiEntityFilter[]
  groupBy?: WikiEntityGroupConfig
  /**
   * Enum labels resolved on the server so the static HTML and the first paint show
   * localized text instead of raw ids (the client catalog chunk loads asynchronously).
   */
  enumLabels?: Partial<Record<WikiEnumGroup, Record<string, string>>>
  /** Canonical enum id order per group (generated enums.json key order). */
  enumOrder?: Partial<Record<WikiEnumGroup, readonly string[]>>
}

function filterValue(entity: GridEntity, field: WikiFilterField): string {
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

/**
 * Model tier badge key. Prefers the build-time `modelKey` written by
 * localizeWikiEntitySummary; falls back to the raw summary's zh-CN name. Never derived
 * from the displayed name — only zh-CN spells the tier as "·壹型".
 */
export function getWikiEquipmentModelKey(entity: GridEntity): string | undefined {
  if (entity.category !== 'equipment') return undefined
  if ('modelKey' in entity && entity.modelKey) return entity.modelKey
  return typeof entity.name === 'string' ? undefined : equipmentModelKeyFromZhCN(entity.name['zh-CN'])
}

export function sortWikiEntities<T extends GridEntity>(
  entities: T[],
  locale: WikiLocale,
  isUp: (entity: T) => boolean = () => false,
  nameFor: (entity: T) => string = (entity) => entity.id
): T[] {
  return [...entities].sort((left, right) => {
    const upDifference = Number(isUp(right)) - Number(isUp(left))
    if (upDifference !== 0) return upDifference
    if (left.rarity !== right.rarity) return right.rarity - left.rarity
    return nameFor(left).localeCompare(nameFor(right), locale)
  })
}

export interface WikiEntityGroup {
  key: string
  label: string
  entities: GridEntity[]
}

export function groupWikiEntities(
  entities: GridEntity[],
  config: WikiEntityGroupConfig,
  locale: WikiLocale,
  labelFor: (group: WikiEnumGroup, id: string) => string,
  /** Canonical enum id order; groups outside it fall back to label collation. */
  enumOrder: readonly string[] = []
): WikiEntityGroup[] {
  const groups = new Map<string, GridEntity[]>()
  for (const entity of entities) {
    const key = filterValue(entity, config.field)
    if (!key) continue
    const group = groups.get(key) ?? []
    group.push(entity)
    groups.set(key, group)
  }
  const order = new Map(enumOrder.map((key, index) => [key, index]))
  return [...groups].map(([key, group]) => ({
    key,
    label: labelFor(config.enumGroup, key),
    entities: group,
  })).sort((left, right) =>
    (order.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.key) ?? Number.MAX_SAFE_INTEGER) ||
    left.label.localeCompare(right.label, locale)
  )
}
export interface WikiEquipmentGroup {
  key: string
  label: string
  entities: Array<WikiEquipmentSummary | LocalizedWikiEntitySummary>
}

export function groupWikiEquipmentBySuit(
  entities: Array<WikiEquipmentSummary | (LocalizedWikiEntitySummary & { partTypeId: string; suitId?: string; suitName?: string | NonNullable<WikiEquipmentSummary['suitName']> })>,
  locale: WikiLocale,
  noSetLabel = 'No set'
): WikiEquipmentGroup[] {
  const groups = new Map<string, typeof entities>()
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
        : (typeof group[0]?.suitName === 'string'
          ? group[0].suitName
          : group[0]?.suitName?.[locale] || group[0]?.suitName?.['zh-CN'] || key),
      entities: [...group].sort((left, right) =>
        right.rarity - left.rarity ||
        left.partTypeId.localeCompare(right.partTypeId) ||
        entityDisplayName(left, locale).localeCompare(entityDisplayName(right, locale), locale)
      ),
    }))
    .sort((left, right) =>
      left.key === '__no-set__' ? -1 :
        right.key === '__no-set__' ? 1 :
          (right.entities[0]?.rarity ?? 0) - (left.entities[0]?.rarity ?? 0) || left.label.localeCompare(right.label, locale)
    )
}

/**
 * Suit groups are collapsed by default, but a narrowed list (search term or active
 * filters) must show every match so the "N results" count stays truthful.
 */
export function isWikiGroupExpanded(
  groupKey: string,
  expandedKeys: readonly string[],
  narrowed: boolean,
): boolean {
  return narrowed || expandedKeys.includes(groupKey)
}

export function getWikiEntityUpStatus(
  entity: GridEntity,
  upNames: ReadonlySet<string>,
  associations: ReadonlyMap<string, string[]> = weaponCharacters
) {
  if (entity.category === 'characters') {
    return upNames.has(entityNameZhCN(entity))
  }
  if (entity.category === 'weapons') {
    return associations.get(entity.id)?.some((name) => upNames.has(name)) ?? false
  }
  return false
}

export const WikiEntityGrid = memo(function WikiEntityGrid({
  entities,
  imageBasePath,
  filters = [],
  groupBy,
  enumLabels,
  enumOrder,
}: WikiEntityGridProps) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const { entityName, enumLabel, suitName } = useWikiTranslations()
  /** Server label first (no raw ids in the static HTML), client catalog as fallback. */
  const labelFor = useCallback(
    (group: WikiEnumGroup, id: string) => enumLabels?.[group]?.[id] ?? enumLabel(group, id),
    [enumLabel, enumLabels],
  )
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
      const values = new Set(entities.map((entity) => filterValue(entity, filter.field)).filter(Boolean))
      result[filter.field] = [...values].sort((left, right) => {
        if (filter.field === 'rarity') return Number(right) - Number(left)
        const order = filter.enumGroup ? enumOrder?.[filter.enumGroup] : undefined
        if (order) {
          const leftIndex = order.indexOf(left)
          const rightIndex = order.indexOf(right)
          if (leftIndex !== rightIndex) {
            return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
          }
        }
        const leftLabel = filter.enumGroup ? labelFor(filter.enumGroup, left) : left
        const rightLabel = filter.enumGroup ? labelFor(filter.enumGroup, right) : right
        return leftLabel.localeCompare(rightLabel, locale)
      })
    }
    return result
  }, [entities, enumOrder, filters, labelFor, locale])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale)
    const matches = entities.filter((entity) => {
      const name = entityName(entity)
      if (term && !name.toLocaleLowerCase(locale).includes(term) && !entity.id.includes(term)) return false
      return Object.entries(activeFilters).every(([field, selected]) => selected.size === 0 || selected.has(filterValue(entity, field as WikiFilterField)))
    })
    return sortWikiEntities(matches, locale, (entity) => getWikiEntityUpStatus(entity, upNames), entityName)
  }, [activeFilters, entities, entityName, locale, search, upNames])

  const toggleFilter = useCallback((field: string, value: string) => {
    setActiveFilters((current) => {
      const selected = new Set(current[field] ?? [])
      if (selected.has(value)) selected.delete(value)
      else selected.add(value)
      return { ...current, [field]: selected }
    })
  }, [])

  const hasActiveFilters = Object.values(activeFilters).some((selected) => selected.size > 0)
  const isNarrowed = search.trim().length > 0 || hasActiveFilters
  const activeFilterCount = Object.values(activeFilters).reduce((count, selected) => count + selected.size, 0)
  const filteredEquipment = useMemo(
    () => filtered.filter((entity): entity is GridEntity & { category: 'equipment'; partTypeId: string } => entity.category === 'equipment'),
    [filtered]
  )
  const equipmentGroups = useMemo(
    () => filteredEquipment.length > 0
      ? groupWikiEquipmentBySuit(filteredEquipment, locale, t('wiki.noSet')).map((group) => ({
        ...group,
        // Keep the build-time localized suit name; only fall back to the client
        // catalog when the summary carried no suitName (label === raw suit id).
        label: group.label === group.key ? suitName(group.key) : group.label,
      }))
      : [],
    [filteredEquipment, locale, suitName, t]
  )
  const entityGroups = useMemo(
    () => groupBy && filteredEquipment.length === 0
      ? groupWikiEntities(filtered, groupBy, locale, labelFor, enumOrder?.[groupBy.enumGroup])
      : [],
    [enumOrder, filtered, filteredEquipment.length, groupBy, labelFor, locale]
  )
  const renderEntity = (entity: GridEntity) => {
    const imageSrc = withImageCacheVersion(`${imageBasePath}/${entity.imageId}.avif`)
    const displayName = entityName(entity)
    const isUp = getWikiEntityUpStatus(entity, upNames)
    const equipmentModelKey = getWikiEquipmentModelKey(entity)
    const badges = entity.category === 'equipment' ? (
      <span className="flex flex-col items-start gap-0.5">
        <span className="rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-stone-100 shadow-[var(--shadow-border)]">
          {labelFor('equipmentParts', entity.partTypeId)}
        </span>
        {equipmentModelKey ? <span className="rounded bg-amber-500/85 px-1.5 py-0.5 text-[10px] font-semibold text-black">{t(equipmentModelKey)}</span> : null}
      </span>
    ) : isUp ? (
      <Image src="/up.png" alt="UP" width={132} height={60} className="h-auto w-11 object-contain drop-shadow-md" unoptimized />
    ) : undefined
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
          imageClassName={entity.category === 'characters' || entity.category === 'equipment' ? 'object-cover' : 'object-contain p-3'}
          badges={badges}
          badgeClassName={entity.category === 'equipment' ? 'left-1 top-1' : 'left-auto right-0 top-2'}
          className={entity.category === 'characters' ? 'aspect-[38/47] rounded-none shadow-none' : 'rounded-none shadow-none'}
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
                          label={filter.field === 'rarity' ? `${value}★` : filter.enumGroup ? labelFor(filter.enumGroup, value) : value}
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
            {isNarrowed ? t('wiki.noMatch') : t('wiki.noData')}
          </p>
        ) : equipmentGroups.length > 0 ? (
          <div className="space-y-2">
            {equipmentGroups.map((group) => {
              const expanded = isWikiGroupExpanded(group.key, expandedSuitKeys, isNarrowed)
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
        ) : entityGroups.length > 0 ? (
          <div className="space-y-5">
            {entityGroups.map((group) => (
              <section key={group.key} className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <Badge variant="secondary">{group.entities.length}</Badge>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
                  {group.entities.map(renderEntity)}
                </div>
              </section>
            ))}
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
