'use client'

import { memo, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EquipSetGroup } from './equip-set-group'
import { useRefinementStore, useGroupedSets } from '@/stores/useRefinementStore'
import {
  sub1StatOptions,
  sub2StatOptions,
  specialStatOptions,
} from '@/data/equips'

type FilterGroup = 'sub1' | 'sub2' | 'special'

interface FilterChipProps {
  value: string
  isSelected: boolean
  onToggle: () => void
}

const FilterChip = memo(function FilterChip({
  value,
  isSelected,
  onToggle,
}: FilterChipProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onToggle}
      aria-pressed={isSelected}
      className={cn(
        'w-full px-1 py-0.5 rounded text-[11px] text-center border transition-colors bg-muted/60 h-auto min-h-0 min-w-0',
        isSelected &&
          'bg-primary text-primary-foreground border-primary',
        !isSelected &&
          'border-border hover:border-foreground/40 hover:bg-muted/80',
      )}
    >
      {value}
    </Button>
  )
})

const REFINEMENT_FILTER_GROUPS: { filterKey: FilterGroup; labelKey: string; options: string[] }[] = [
  { filterKey: 'sub1', labelKey: 'refinement.subAttr1', options: sub1StatOptions },
  { filterKey: 'sub2', labelKey: 'refinement.subAttr2', options: sub2StatOptions },
  { filterKey: 'special', labelKey: 'refinement.specialEffect', options: specialStatOptions },
]

export const EquipList = memo(function EquipList() {
  const t = useTranslations()
  const searchQuery = useRefinementStore((s) => s.searchQuery)
  const setSearchQuery = useRefinementStore((s) => s.setSearchQuery)
  const filterCollapsed = useRefinementStore((s) => s.filterCollapsed)
  const toggleFilterCollapsed = useRefinementStore((s) => s.toggleFilterCollapsed)
  const toggleFilter = useRefinementStore((s) => s.toggleFilter)
  const clearFilters = useRefinementStore((s) => s.clearFilters)
  const filterSub1 = useRefinementStore((s) => s.filterSub1)
  const filterSub2 = useRefinementStore((s) => s.filterSub2)
  const filterSpecial = useRefinementStore((s) => s.filterSpecial)
  const groupedSets = useGroupedSets()

  const filterState = useMemo(
    () => ({ sub1: filterSub1, sub2: filterSub2, special: filterSpecial }),
    [filterSub1, filterSub2, filterSpecial],
  )

  const hasActiveFilters =
    filterSub1.length > 0 || filterSub2.length > 0 || filterSpecial.length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <Input
        placeholder={t('refinement.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="text-sm"
      />

      {/* Attribute filter — collapsible */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={toggleFilterCollapsed}
          className="flex w-full items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors h-auto p-0"
        >
          <span className="flex-1 text-left">
            {t('refinement.attributeFilters')}
          </span>
          <ChevronDown
            className={cn(
              'size-3 transition-transform',
              filterCollapsed ? '-rotate-90' : 'rotate-0',
            )}
          />
        </Button>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={clearFilters}
            className="text-[10px] text-muted-foreground hover:text-foreground h-auto px-1 -mt-0.5"
          >
            {t('refinement.clearFilters')}
          </Button>
        )}
        <div
          className={cn(
            'grid transition-all duration-200 ease-out',
            filterCollapsed
              ? 'grid-rows-[0fr] opacity-0'
              : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 mt-1.5">
              {REFINEMENT_FILTER_GROUPS.map(({ filterKey, labelKey, options }) => {
                const selected = filterState[filterKey]
                return (
                  <div key={filterKey} className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {t(labelKey)}
                    </span>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1">
                      {options.map((v) => (
                        <FilterChip
                          key={v}
                          value={v}
                          isSelected={selected.includes(v)}
                          onToggle={() => toggleFilter(filterKey, v)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grouped equip list */}
      {groupedSets.length > 0 ? (
        <div className="flex flex-col gap-2">
          {groupedSets.map((group) => (
            <EquipSetGroup
              key={group.setName}
              setName={group.setName}
              equips={group.equips}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('refinement.noMatchingEquip')}
        </p>
      )}
    </div>
  )
})
