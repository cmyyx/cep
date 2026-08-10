'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Check, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FilterGroup } from '@/components/shared/filter-group'
import { FilterPanel } from '@/components/shared/filter-panel'
import { PlannerPreviewTooltip } from '@/components/shared/planner-preview-tooltip'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { sortWikiEntities } from '@/components/wiki/wiki-entity-grid'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { PLANNER_SELECTED_BADGE_CLASS, PLANNER_SELECTED_RING_CLASS } from '@/lib/planner-selection-styles'
import { cn } from '@/lib/utils'
import type { WikiEntitySummary, WikiEnumGroup, WikiLocale } from '@/types/wiki'

export type EntityPickerFilterField = 'rarity' | 'elementId' | 'professionId' | 'weaponTypeId' | 'partTypeId'
export interface EntityPickerFilter {
  field: EntityPickerFilterField
  labelKey: string
  enumGroup?: WikiEnumGroup
}

export interface WikiEntityPickerProps {
  title: string
  entities: WikiEntitySummary[]
  imageBasePath: string
  selectedIds: string[]
  onSelect: (entity: WikiEntitySummary) => void
  renderTooltip?: (entity: WikiEntitySummary) => ReactNode
  filters?: EntityPickerFilter[]
  className?: string
  gridClassName?: string
  selectionTone?: 'develop' | 'preview' | 'amber'
}

function filterValue(entity: WikiEntitySummary, field: EntityPickerFilterField): string {
  if (field === 'rarity') return String(entity.rarity)
  if (field === 'elementId') return entity.category === 'characters' ? entity.elementId : ''
  if (field === 'professionId') return entity.category === 'characters' ? entity.professionId : ''
  if (field === 'weaponTypeId') return entity.category === 'equipment' ? '' : entity.weaponTypeId
  return entity.category === 'equipment' ? entity.partTypeId : ''
}

export function WikiEntityPicker({ title, entities, imageBasePath, selectedIds, onSelect, filters = [], className, gridClassName, selectionTone = 'develop', renderTooltip }: WikiEntityPickerProps) {
  const t = useTranslations()
  const locale = useLocale() as WikiLocale
  const { entityName, enumLabel: generatedEnumLabel } = useWikiTranslations()
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const filterValues = useMemo(() => Object.fromEntries(filters.map((filter) => {
    const values = [...new Set(entities.map((entity) => filterValue(entity, filter.field)).filter(Boolean))]
    values.sort((left, right) => {
      if (filter.field === 'rarity') return Number(right) - Number(left)
      const leftLabel = filter.enumGroup ? generatedEnumLabel(filter.enumGroup, left) : left
      const rightLabel = filter.enumGroup ? generatedEnumLabel(filter.enumGroup, right) : right
      return leftLabel.localeCompare(rightLabel, locale)
    })
    return [filter.field, values]
  })), [entities, filters, generatedEnumLabel, locale])
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale)
    return sortWikiEntities(
      entities.filter((entity) => {
        const name = entityName(entity)
        if (term && !name.toLocaleLowerCase(locale).includes(term) && !entity.id.toLocaleLowerCase(locale).includes(term)) return false
        return Object.entries(activeFilters).every(([field, values]) => values.length === 0 || values.includes(filterValue(entity, field as EntityPickerFilterField)))
      }),
      locale,
      () => false,
      entityName
    )
  }, [activeFilters, entities, entityName, locale, search])
  const activeCount = Object.values(activeFilters).reduce((count, values) => count + values.length, 0)
  const enumLabel = (group: WikiEnumGroup | undefined, value: string) => group ? generatedEnumLabel(group, value) : value
  const selectedRingClass = selectionTone === 'amber' ? PLANNER_SELECTED_RING_CLASS : selectionTone === 'preview' ? 'ring-2 ring-preview-pink' : 'ring-2 ring-develop-blue'
  const selectedBadgeClass = selectionTone === 'amber' ? PLANNER_SELECTED_BADGE_CLASS : selectionTone === 'preview' ? 'bg-preview-pink text-white' : 'bg-develop-blue text-white'

  return (
    <section className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="secondary">{filtered.length}</Badge>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('wiki.searchPlaceholder')} aria-label={t('wiki.searchPlaceholder')} className="pl-8" />
      </div>
      {filters.length > 0 && (
        <FilterPanel
          title={t('wiki.filterToggle')}
          collapsed={!filtersOpen}
          onToggle={() => setFiltersOpen((open) => !open)}
          activeCount={activeCount}
          onClear={() => setActiveFilters({})}
          clearLabel={t('wiki.clearFilters')}
        >
          {filters.map((filter) => {
            const selectedValues = activeFilters[filter.field] ?? []
            return (
              <FilterGroup
                key={filter.field}
                label={t(filter.labelKey)}
                chips={(filterValues[filter.field] ?? []).map((value) => ({
                  key: value,
                  label: filter.field === 'rarity' ? `${value}★` : enumLabel(filter.enumGroup, value),
                  valid: true,
                  selected: selectedValues.includes(value),
                  onToggle: () => setActiveFilters((current) => ({
                    ...current,
                    [filter.field]: selectedValues.includes(value)
                      ? selectedValues.filter((entry) => entry !== value)
                      : [...selectedValues, value],
                  })),
                }))}
              />
            )
          })}
        </FilterPanel>
      )}
      <div className={cn('grid content-start items-start grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2', gridClassName)}>
        {filtered.map((entity) => {
          const name = entityName(entity)
          const isSelected = selected.has(entity.id)
          const tooltip = renderTooltip?.(entity)
          return (
            <PlannerPreviewTooltip
              key={entity.id}
              content={tooltip}
              onClick={() => onSelect(entity)}
              aria-label={name}
              aria-pressed={isSelected}
              className={cn('relative h-auto min-w-0 self-start rounded-lg p-0 shadow-[var(--shadow-border)]', isSelected && selectedRingClass)}
            >
              <RarityFrame
                imageSrc={`${imageBasePath}/${entity.imageId}.avif`}
                backgroundSrc={entity.category === 'characters' ? '/images/character-frame-bg.png' : undefined}
                title={name}
                rarity={entity.rarity}
                imageClassName={entity.category === 'weapons' ? 'object-contain p-3' : 'object-cover'}
                className={cn('w-full rounded-lg shadow-none', entity.category === 'characters' && 'aspect-[38/47]')}
                badges={isSelected ? <span className={cn('flex size-5 items-center justify-center rounded-full', selectedBadgeClass)}><Check className="size-3" /></span> : undefined}
                badgeClassName="left-auto right-1.5 top-1.5"
              />
            </PlannerPreviewTooltip>
          )
        })}
      </div>
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('wiki.noMatch')}</p>}
    </section>
  )
}
