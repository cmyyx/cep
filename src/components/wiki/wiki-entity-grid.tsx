'use client'

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search, SearchX, X } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useBannerStore } from '@/stores/useBannerStore'
import { weapons } from '@/data/weapons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { getRarityColorClass, normalizeRarity } from '@/components/shared/rarity-stars'
import { FilterGroup } from '@/components/shared/filter-group'
import { FilterPanel } from '@/components/shared/filter-panel'
import { NavLink } from '@/components/shared/nav-link'
import { cn } from '@/lib/utils'
import { withImageCacheVersion } from '@/lib/image-url'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { equipSubAttrKey } from '@/lib/equip-substats'
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
  | 'sub1'
  | 'sub2'
  | 'special'

type WikiGroupField = 'elementId' | 'weaponTypeId'

interface WikiEntityFilter {
  field: WikiFilterField
  labelKey: string
  enumGroup?: WikiEnumGroup
  /**
   * 筛选值标签的 i18n 前缀 (如 'equipStats'): chip 与空态条件用 t(`${prefix}.${value}`) 解析。
   * RSC 边界不能传函数, 因此用命名空间字符串; 未提供时回退到 enumGroup / 原始值。
   */
  labelPrefix?: string
}

interface WikiEntityGroupConfig {
  field: WikiGroupField
  enumGroup: WikiEnumGroup
}

type GridEntity = WikiEntitySummary | LocalizedWikiEntitySummary

type EnumLabelResolver = (group: WikiEnumGroup, id: string) => string

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

/** Key used by equipment that belongs to no suit; always sorted last. */
export const WIKI_NO_SET_KEY = '__no-set__'

/**
 * Below this length an id substring match is worthless: equipment ids look like
 * `item_equip_t0_parts_tundra01_body_01`, so a single `t`/`e`/`0` matches all 243
 * entries, flips the list into "narrowed" mode and force-mounts every card. Latin
 * typists and pinyin IMEs hit that on literally every keystroke.
 */
export const WIKI_ID_SEARCH_MIN_LENGTH = 3

/** How many suit groups open themselves on a first visit (no persisted choice yet). */
export const WIKI_DEFAULT_EXPANDED_GROUPS = 2

const CARD_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]'

/**
 * 分类分组的 sticky 标题条。
 *
 * 历史: 早期是满幅不透明白条 → 浅色主题下与画布同色、读不出层级;
 * 后改为负边距满幅 + 半透明毛玻璃。但满幅负边距让标题溢出滚动容器、
 * 在中等屏宽变成一条神秘长白条, 且 z-20 与卡片内的稀有度 z-20 色带
 * 持平, 色带会冒到标题之上。
 *
 * 现在: 取消负边距, 标题限在滚动容器的 px 内 (不再溢出成超长白条);
 * 背景改用不透明 bg-card (在浅色画布上仍可读, 不再隐身);
 * z-30 压过卡片内的稀有度色带 (z-20)。
 */
export const WIKI_GROUP_HEADER_CLASS =
  'sticky top-0 z-30 flex min-w-0 items-center gap-2 bg-card px-1 py-1 shadow-[0_1px_0_0_var(--border)]'

export function filterValue(entity: GridEntity, field: WikiFilterField): string {
  if (field === 'rarity') return String(entity.rarity)
  if (field === 'elementId') return entity.category === 'characters' ? entity.elementId : ''
  if (field === 'professionId') return entity.category === 'characters' ? entity.professionId : ''
  if (field === 'weaponTypeId') {
    return entity.category === 'equipment' ? '' : entity.weaponTypeId
  }
  // 精锻属性筛选仅对装备生效: 5★ 装备在 equipSubAttrsById 有记录, 其余返回空串。
  if (field === 'sub1' || field === 'sub2' || field === 'special') {
    return entity.category === 'equipment' ? equipSubAttrKey(entity.id, field) : ''
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

/**
 * Name match first; the id is only a fallback for long, deliberate queries.
 * `term` is expected pre-trimmed and lower-cased by the caller.
 */
export function matchesWikiSearchTerm(
  entity: Pick<GridEntity, 'id'>,
  displayName: string,
  term: string,
  locale: string,
): boolean {
  if (!term) return true
  if (displayName.toLocaleLowerCase(locale).includes(term)) return true
  return term.length >= WIKI_ID_SEARCH_MIN_LENGTH && entity.id.toLowerCase().includes(term)
}

/** Numeric enum ids ("0", "12") mean the catalog has not resolved a real label yet. */
function isUnresolvedEnumLabel(label: string): boolean {
  return label.length === 0 || /^\d+$/.test(label)
}

/**
 * The one secondary attribute a card shows under its name: profession + element for
 * operators, type for weapons, part for equipment. Without it a wiki list is 29..243
 * unlabelled thumbnails.
 */
export function wikiEntityMetaLabel(entity: GridEntity, labelFor: EnumLabelResolver): string {
  const resolve = (group: WikiEnumGroup, id: string): string => {
    if (!id) return ''
    const label = labelFor(group, id)
    return isUnresolvedEnumLabel(label) ? '' : label
  }
  if (entity.category === 'characters') {
    return [resolve('professions', entity.professionId), resolve('elements', entity.elementId)]
      .filter(Boolean)
      .join(' · ')
  }
  if (entity.category === 'weapons') return resolve('weaponTypes', entity.weaponTypeId)
  return resolve('equipmentParts', entity.partTypeId)
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
    const key = entity.suitId ?? WIKI_NO_SET_KEY
    const group = groups.get(key) ?? []
    group.push(entity)
    groups.set(key, group)
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: key === WIKI_NO_SET_KEY
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
    // "Independent equipment" is a 43-item grab bag with no shared identity — it is a
    // footer, not a headline. Real suits lead, ordered by their best piece.
    .sort((left, right) =>
      left.key === WIKI_NO_SET_KEY ? 1 :
        right.key === WIKI_NO_SET_KEY ? -1 :
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

/**
 * First-visit expansion: open the leading real suits so the landing screen shows
 * actual cards instead of a wall of collapsed rows.
 */
export function defaultExpandedWikiGroups(
  groups: readonly { key: string }[],
  count: number = WIKI_DEFAULT_EXPANDED_GROUPS,
): string[] {
  return groups
    .filter((group) => group.key !== WIKI_NO_SET_KEY)
    .slice(0, count)
    .map((group) => group.key)
}

/** Toggles against the *effective* key list, so first-visit defaults are not wiped. */
export function toggleWikiGroupKey(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((value) => value !== key) : [...keys, key]
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
  // The input stays instant; only the 243-card filter/render pass lags behind.
  const deferredSearch = useDeferredValue(search)
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({})
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  // Persisted expansion must not reach the first client render: the static HTML was
  // built without localStorage, so reading it eagerly would be a hydration mismatch.
  const [hydrated, setHydrated] = useState(false)
  const storedSuitKeys = useWikiStore((state) => state.expandedEquipmentGroups)
  const hasStoredExpansion = useWikiStore((state) => state.hasStoredExpansion)
  const setExpandedSuitKeys = useWikiStore((state) => state.setExpandedEquipmentGroups)
  const storedTypeKeys = useWikiStore((state) => state.expandedTypeGroups)
  const hasStoredTypeExpansion = useWikiStore((state) => state.hasStoredTypeExpansion)
  const setExpandedTypeKeys = useWikiStore((state) => state.setExpandedTypeGroups)
  const upCharacterNames = useBannerStore((state) => state.upCharacterNames)
  const refreshBannerStatus = useBannerStore((state) => state.refreshBannerStatus)
  const upNames = useMemo(() => new Set(upCharacterNames), [upCharacterNames])

  /**
   * 筛选值的展示标签: labelPrefix → i18n (如 equipStats.41 → 智识);
   * 否则回退到稀有度 / enumGroup / 原始值。
   */
  const valueLabel = useCallback(
    (filter: WikiEntityFilter, value: string) => {
      if (filter.labelPrefix) return t(`${filter.labelPrefix}.${value}`)
      if (filter.field === 'rarity') return `${value}★`
      return filter.enumGroup ? labelFor(filter.enumGroup, value) : value
    },
    [labelFor, t],
  )
  useEffect(() => setHydrated(true), [])

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
        const leftLabel = valueLabel(filter, left)
        const rightLabel = valueLabel(filter, right)
        return leftLabel.localeCompare(rightLabel, locale)
      })
    }
    return result
  }, [entities, enumOrder, filters, locale, valueLabel])

  const searchTerm = deferredSearch.trim()

  const filtered = useMemo(() => {
    const term = searchTerm.toLocaleLowerCase(locale)
    const matches = entities.filter((entity) => {
      if (!matchesWikiSearchTerm(entity, entityName(entity), term, locale)) return false
      return Object.entries(activeFilters).every(([field, selected]) => selected.size === 0 || selected.has(filterValue(entity, field as WikiFilterField)))
    })
    return sortWikiEntities(matches, locale, (entity) => getWikiEntityUpStatus(entity, upNames), entityName)
  }, [activeFilters, entities, entityName, locale, searchTerm, upNames])

  const toggleFilter = useCallback((field: string, value: string) => {
    setActiveFilters((current) => {
      const selected = new Set(current[field] ?? [])
      if (selected.has(value)) selected.delete(value)
      else selected.add(value)
      return { ...current, [field]: selected }
    })
  }, [])

  const resetAll = useCallback(() => {
    setSearch('')
    setActiveFilters({})
  }, [])

  const hasActiveFilters = Object.values(activeFilters).some((selected) => selected.size > 0)
  const isNarrowed = searchTerm.length > 0 || hasActiveFilters
  const activeFilterCount = Object.values(activeFilters).reduce((count, selected) => count + selected.size, 0)
  /** Human-readable "why is my list empty" list for the empty state. */
  const activeConditions = useMemo(() => {
    const conditions: string[] = []
    if (searchTerm) conditions.push(t('wiki.searchCondition', { term: searchTerm }))
    for (const filter of filters) {
      const selected = activeFilters[filter.field]
      if (!selected || selected.size === 0) continue
      const values = [...selected].map((value) => valueLabel(filter, value))
      conditions.push(`${t(filter.labelKey)}: ${values.join(' / ')}`)
    }
    return conditions
  }, [activeFilters, filters, searchTerm, t, valueLabel])
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
  const defaultSuitKeys = useMemo(() => defaultExpandedWikiGroups(equipmentGroups), [equipmentGroups])
  const expandedSuitKeys = hydrated && hasStoredExpansion ? storedSuitKeys : defaultSuitKeys
  const toggleSuitExpanded = useCallback(
    (key: string) => setExpandedSuitKeys(toggleWikiGroupKey(expandedSuitKeys, key)),
    [expandedSuitKeys, setExpandedSuitKeys],
  )
  // Entity-type groups (wiki weapons page): collapsible like the suit groups.
  const defaultTypeKeys = useMemo(() => defaultExpandedWikiGroups(entityGroups), [entityGroups])
  const expandedTypeKeys = hydrated && hasStoredTypeExpansion ? storedTypeKeys : defaultTypeKeys
  const toggleTypeExpanded = useCallback(
    (key: string) => setExpandedTypeKeys(toggleWikiGroupKey(expandedTypeKeys, key)),
    [expandedTypeKeys, setExpandedTypeKeys],
  )
  const renderEntity = (entity: GridEntity) => {
    const imageSrc = withImageCacheVersion(`${imageBasePath}/${entity.imageId}.avif`)
    const displayName = entityName(entity)
    const isUp = getWikiEntityUpStatus(entity, upNames)
    const equipmentModelKey = getWikiEquipmentModelKey(entity)
    const rarity = normalizeRarity(entity.rarity)
    const metaLabel = wikiEntityMetaLabel(entity, labelFor)
    const badges = entity.category === 'equipment' ? (
      equipmentModelKey ? (
        <span className="rounded bg-black/65 px-1.5 py-0.5 font-geist-mono text-[10px] font-medium uppercase leading-none text-stone-100 shadow-[var(--shadow-border)]">
          {t(equipmentModelKey)}
        </span>
      ) : undefined
    ) : isUp ? (
      <Image src="/up.png" alt="UP" width={132} height={60} className="h-auto w-11 object-contain drop-shadow-md" unoptimized />
    ) : undefined
    return (
      <NavLink
        key={entity.id}
        href={`/${locale}/wiki/${entity.category}/${entity.id}`}
        loadingLabel={displayName}
        className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)] outline-none transition-shadow hover:shadow-[var(--shadow-card)] focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <RarityFrame
          imageSrc={imageSrc}
          backgroundSrc={entity.category === 'characters' ? '/images/character-frame-bg.png' : undefined}
          title={displayName}
          imageAlt=""
          showTitle={false}
          rarity={entity.rarity}
          imageClassName={entity.category === 'characters' || entity.category === 'equipment' ? 'object-cover' : 'object-contain p-3'}
          badges={badges}
          badgeClassName={entity.category === 'equipment' ? 'left-1 top-1' : 'left-auto right-1 top-1'}
          className={entity.category === 'characters' ? 'aspect-[38/47] rounded-none shadow-none' : 'rounded-none shadow-none'}
        />
        {/* Label plate: the name lives on a solid surface, so it can wrap to two lines
            instead of truncating every member of a suit to the same shared prefix. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-2 pb-1.5 pt-1.5">
          <h3 className="line-clamp-2 text-xs font-medium leading-snug tracking-tight text-foreground">
            {displayName}
          </h3>
          <p className="mt-auto flex min-w-0 items-center gap-1.5 text-[11px] leading-none">
            <span
              role="img"
              aria-label={`${rarity}★`}
              className={cn('shrink-0 font-geist-mono font-medium tabular-nums', getRarityColorClass(rarity))}
            >
              ★{rarity}
            </span>
            {metaLabel ? <span className="min-w-0 truncate text-muted-foreground">{metaLabel}</span> : null}
          </p>
        </div>
      </NavLink>
    )
  }

  const showGroupCount = equipmentGroups.length > 0
  const showTypeGroupCount = entityGroups.length > 0
  const groupCountLabel = showGroupCount ? t('wiki.groupCount', { count: equipmentGroups.length }) : showTypeGroupCount ? t('wiki.groupCount', { count: entityGroups.length }) : ''
  const resultCountText = isNarrowed
    ? t('wiki.resultCountFiltered', { count: filtered.length, total: entities.length })
    : t('wiki.resultCount', { count: filtered.length })
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <div className="relative flex items-center">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              aria-label={t('wiki.searchPlaceholder')}
              placeholder={t('wiki.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-8 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t('wiki.clearSearch')}
                onClick={() => setSearch('')}
                className="absolute right-1.5"
              >
                <X />
              </Button>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-live="polite" className="font-geist-mono text-xs text-muted-foreground">
              {resultCountText}
              {groupCountLabel ? ` · ${groupCountLabel}` : null}
            </span>
            {(showGroupCount || showTypeGroupCount) && !isNarrowed && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    if (showGroupCount) setExpandedSuitKeys(equipmentGroups.map((group) => group.key))
                    else setExpandedTypeKeys(entityGroups.map((group) => group.key))
                  }}
                >
                  {t('wiki.expandAll')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    if (showGroupCount) setExpandedSuitKeys([])
                    else setExpandedTypeKeys([])
                  }}
                >
                  {t('wiki.collapseAll')}
                </Button>
              </span>
            )}
          </div>
        </div>
        {filters.length > 0 && (
          <FilterPanel
            title={t('wiki.filterToggle')}
            collapsed={!filterPanelOpen}
            onToggle={() => setFilterPanelOpen((open) => !open)}
            activeCount={activeFilterCount}
            onClear={() => setActiveFilters({})}
            clearLabel={t('wiki.clearFilters')}
          >
            {filters.map((filter) => (
              <FilterGroup
                key={filter.field}
                label={t(filter.labelKey)}
                chips={(filterValues[filter.field] ?? []).map((value) => ({
                  key: value,
                  label: valueLabel(filter, value),
                  valid: true,
                  selected: activeFilters[filter.field]?.has(value) ?? false,
                  onToggle: () => toggleFilter(filter.field, value),
                }))}
              />
            ))}
          </FilterPanel>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-3 rounded-lg bg-card p-6 text-center shadow-[var(--shadow-card)]">
            <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">{isNarrowed ? t('wiki.noMatch') : t('wiki.noData')}</p>
            {isNarrowed && (
              <>
                <span className="flex flex-wrap justify-center gap-1.5">
                  {activeConditions.map((condition) => (
                    <Badge key={condition} variant="secondary" className="max-w-full truncate">{condition}</Badge>
                  ))}
                </span>
                <Button type="button" size="sm" onClick={resetAll}>{t('wiki.resetAll')}</Button>
              </>
            )}
          </div>
        ) : equipmentGroups.length > 0 ? (
          <div className="space-y-2">
            {equipmentGroups.map((group) => {
              const expanded = isWikiGroupExpanded(group.key, expandedSuitKeys, isNarrowed)
              return (
                <section key={group.key} className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
                  {/* While narrowed every group is force-expanded, so a toggle would do
                      nothing visible yet still rewrite the persisted expansion state. */}
                  {isNarrowed ? (
                    <div className="flex min-h-10 w-full items-center gap-2 px-3">
                      <h2 className="min-w-0 flex-1 truncate text-left text-sm font-medium">{group.label}</h2>
                      <Badge variant="secondary">{group.entities.length}</Badge>
                    </div>
                  ) : (
                    <h2>
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
                    </h2>
                  )}
                  {expanded && (
                    <div className={cn(CARD_GRID_CLASS, 'p-3 pt-1')}>
                      {group.entities.map(renderEntity)}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        ) : entityGroups.length > 0 ? (
          <div className="space-y-2">
            {entityGroups.map((group) => {
              const expanded = isWikiGroupExpanded(group.key, expandedTypeKeys, isNarrowed)
              return (
                <section key={group.key} className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
                  {/* While narrowed every group is force-expanded, so a toggle would do
                      nothing visible yet still rewrite the persisted expansion state. */}
                  {isNarrowed ? (
                    <div className="flex min-h-10 w-full items-center gap-2 px-3">
                      <h2 className="min-w-0 flex-1 truncate text-left text-sm font-medium">{group.label}</h2>
                      <Badge variant="secondary">{group.entities.length}</Badge>
                    </div>
                  ) : (
                    <h2>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-expanded={expanded}
                        onClick={() => toggleTypeExpanded(group.key)}
                        className="min-h-10 w-full justify-start gap-2 px-3"
                      >
                        <ChevronDown className={expanded ? 'transition-transform' : '-rotate-90 transition-transform'} />
                        <span className="min-w-0 flex-1 truncate text-left font-medium">{group.label}</span>
                        <Badge variant="secondary">{group.entities.length}</Badge>
                      </Button>
                    </h2>
                  )}
                  {expanded && (
                    <div className={cn(CARD_GRID_CLASS, 'p-3 pt-1')}>
                      {group.entities.map(renderEntity)}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <div className={CARD_GRID_CLASS}>
            {filtered.map(renderEntity)}
          </div>
        )}
      </div>
    </div>
  )
})
