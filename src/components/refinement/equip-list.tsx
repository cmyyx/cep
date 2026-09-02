'use client'

import { memo, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { EquipSetGroup } from './equip-set-group'
import { useRefinementStore, useGroupedSets } from '@/stores/useRefinementStore'
import { FilterGroup } from '@/components/shared/filter-group'
import { FilterPanel } from '@/components/shared/filter-panel'
import {
  sub1StatOptions,
  sub2StatOptions,
  specialStatOptions,
} from '@/data/equips'

type FilterSlot = 'sub1' | 'sub2' | 'special'

const REFINEMENT_FILTER_GROUPS: { filterKey: FilterSlot; labelKey: string; options: string[] }[] = [
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

  const activeFilterCount = filterSub1.length + filterSub2.length + filterSpecial.length

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <Input
        placeholder={t('refinement.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="text-sm"
      />

      {/* Attribute filter — collapsible (shared FilterPanel/FilterGroup) */}
      <FilterPanel
        title={t('refinement.attributeFilters')}
        collapsed={filterCollapsed}
        onToggle={toggleFilterCollapsed}
        activeCount={activeFilterCount}
        onClear={clearFilters}
        clearLabel={t('common.clearFilters')}
      >
        {REFINEMENT_FILTER_GROUPS.map(({ filterKey, labelKey, options }) => (
          <FilterGroup
            key={filterKey}
            label={t(labelKey)}
            chipColumnClass={filterKey === 'special' ? 'grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]' : undefined}
            chips={options.map((v) => ({
              key: v,
              label: t('equipStats.' + v),
              valid: true,
              selected: filterState[filterKey].includes(v),
              onToggle: () => toggleFilter(filterKey, v),
            }))}
          />
        ))}
      </FilterPanel>
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
