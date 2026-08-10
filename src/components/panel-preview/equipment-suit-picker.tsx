'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterGroup } from '@/components/shared/filter-group'
import { FilterPanel } from '@/components/shared/filter-panel'
import { PlannerPreviewTooltip } from '@/components/shared/planner-preview-tooltip'
import { PlannerWikiPreview } from '@/components/shared/planner-wiki-preview'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { wikiEquipment } from '@/generated/data/wiki/equipment'
import { wikiEquipmentPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { equipSubAttrKey, type EquipSubSlot } from '@/lib/equip-substats'
import { PLANNER_SELECTED_BADGE_CLASS, PLANNER_SELECTED_RING_CLASS } from '@/lib/planner-selection-styles'
import { cn } from '@/lib/utils'
import type { WikiEquipmentSummary, WikiLocale } from '@/types/wiki'

/** 精锻属性筛选组: 与精锻规划一致, 标签复用 refinement 命名空间。 */
const FILTER_GROUPS: Array<{ slot: EquipSubSlot; labelKey: string }> = [
  { slot: 'sub1', labelKey: 'refinement.subAttr1' },
  { slot: 'sub2', labelKey: 'refinement.subAttr2' },
  { slot: 'special', labelKey: 'refinement.specialEffect' },
]
export interface EquipmentSuitPickerProps {
  partTypeId: string
  selectedId: string | null
  onSelect: (equipment: WikiEquipmentSummary) => void
}

export function EquipmentSuitPicker({ partTypeId, selectedId, onSelect }: EquipmentSuitPickerProps) {
  const t = useTranslations('panelPreview')
  // Reuses the existing shared wiki search string; adds no new i18n key.
  const rootT = useTranslations()
  const locale = useLocale() as WikiLocale
  const { entityName, suitName, equipmentStatLabel } = useWikiTranslations()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filterCollapsed, setFilterCollapsed] = useState(true)
  const [filterSub1, setFilterSub1] = useState<string[]>([])
  const [filterSub2, setFilterSub2] = useState<string[]>([])
  const [filterSpecial, setFilterSpecial] = useState<string[]>([])

  const filterState: Record<EquipSubSlot, string[]> = { sub1: filterSub1, sub2: filterSub2, special: filterSpecial }
  const setFilterState: Record<EquipSubSlot, (value: string[]) => void> = {
    sub1: setFilterSub1,
    sub2: setFilterSub2,
    special: setFilterSpecial,
  }
  const activeFilterCount = filterSub1.length + filterSub2.length + filterSpecial.length

  const toggleFilter = (slot: EquipSubSlot, value: string) => {
    const current = filterState[slot]
    setFilterState[slot](current.includes(value) ? current.filter((v) => v !== value) : [...current, value])
  }
  const clearFilters = () => {
    setFilterSub1([])
    setFilterSub2([])
    setFilterSpecial([])
  }

  /** 该部位实际存在的精锻属性 (5★ 装备才有数据), 不存在的属性不显示。 */
  const filterOptions = useMemo(() => {
    const options: Record<EquipSubSlot, string[]> = { sub1: [], sub2: [], special: [] }
    for (const equipment of wikiEquipment) {
      if (equipment.partTypeId !== partTypeId) continue
      for (const slot of FILTER_GROUPS.map((group) => group.slot)) {
        const key = equipSubAttrKey(equipment.id, slot)
        if (key && !options[slot].includes(key)) options[slot].push(key)
      }
    }
    return options
  }, [partTypeId])

  const groups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale)
    const grouped = new Map<string, WikiEquipmentSummary[]>()
    for (const equipment of wikiEquipment) {
      if (equipment.partTypeId !== partTypeId) continue
      if (term && !entityName(equipment).toLocaleLowerCase(locale).includes(term) && !equipment.id.toLocaleLowerCase(locale).includes(term)) continue
      // 精锻属性筛选: 选中集合为空或该槽位命中。
      if (filterSub1.length > 0 && !filterSub1.includes(equipSubAttrKey(equipment.id, 'sub1'))) continue
      if (filterSub2.length > 0 && !filterSub2.includes(equipSubAttrKey(equipment.id, 'sub2'))) continue
      if (filterSpecial.length > 0 && !filterSpecial.includes(equipSubAttrKey(equipment.id, 'special'))) continue
      const key = equipment.suitId ?? '__no-set__'
      grouped.set(key, [...(grouped.get(key) ?? []), equipment])
    }
    return [...grouped.entries()]
      .map(([key, equipment]) => ({
        key,
        label: key === '__no-set__' ? t('noSetEquipment') : suitName(key),
        equipment: equipment.sort((left, right) => right.rarity - left.rarity || entityName(left).localeCompare(entityName(right))),
      }))
      .sort((left, right) => left.key === '__no-set__' ? -1 : right.key === '__no-set__' ? 1 : (right.equipment[0]?.rarity ?? 0) - (left.equipment[0]?.rarity ?? 0) || left.label.localeCompare(right.label))
  }, [entityName, filterSpecial, filterSub1, filterSub2, locale, partTypeId, search, suitName, t])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
          placeholder={rootT('wiki.searchPlaceholder')}
          aria-label={rootT('wiki.searchPlaceholder')}
        />
      </div>
      {/* 精锻属性筛选: 共享 FilterPanel/FilterGroup, 与精锻规划交互一致。 */}
      <div className="shrink-0">
        <FilterPanel
          title={rootT('refinement.attributeFilters')}
          collapsed={filterCollapsed}
          onToggle={() => setFilterCollapsed((value) => !value)}
          activeCount={activeFilterCount}
          onClear={clearFilters}
          clearLabel={rootT('refinement.clearFilters')}
        >
          {FILTER_GROUPS.map(({ slot, labelKey }) => (
            <FilterGroup
              key={slot}
              label={rootT(labelKey)}
              chips={filterOptions[slot].map((value) => ({
                key: value,
                label: rootT(`equipStats.${value}`),
                valid: true,
                selected: filterState[slot].includes(value),
                onToggle: () => toggleFilter(slot, value),
              }))}
            />
          ))}
        </FilterPanel>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {groups.map((group) => {
          const open = expanded.has(group.key)
          return (
            <section key={group.key} className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full justify-start gap-2 px-3"
                aria-expanded={open}
                onClick={() => setExpanded((current) => {
                  const next = new Set(current)
                  if (next.has(group.key)) next.delete(group.key)
                  else next.add(group.key)
                  return next
                })}
              >
                <ChevronDown className={open ? 'transition-transform' : '-rotate-90 transition-transform'} />
                <span className="min-w-0 flex-1 truncate text-left font-medium">{group.label}</span>
                <Badge variant="secondary">{group.equipment.length}</Badge>
              </Button>
              {open && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 p-3 pt-1">
                  {group.equipment.map((equipment) => {
                    const name = entityName(equipment)
                    const selected = equipment.id === selectedId
                    const preview = wikiEquipmentPlannerPreviews[equipment.id]
                    const previewLabels = preview?.stats[1] ?? preview?.stats[0]
                    const content = preview ? (
                      <PlannerWikiPreview
                        title={name}
                        rarity={equipment.rarity}
                        compact
                        levelOneLabel={previewLabels?.levelOneLabel}
                        maxLevelLabel={previewLabels?.maxLevelLabel}
                        rows={preview.stats.map((stat) => ({
                          label: equipmentStatLabel(stat.attributeId),
                          levelOne: stat.levelOne,
                          maxLevel: stat.maxLevel,
                        }))}
                        wikiHref={`/${locale}/wiki/equipment/${equipment.id}`}
                      />
                    ) : null
                    return (
                      <PlannerPreviewTooltip
                        key={equipment.id}
                        content={content}
                        onClick={() => onSelect(equipment)}
                        aria-label={name}
                        aria-pressed={selected}
                        className={cn(
                          'relative h-auto min-w-0 rounded-lg p-0 shadow-[var(--shadow-border)]',
                          selected && cn('shadow-[0px_0px_0px_1px_#fbbf24,0_25px_50px_-12px_rgba(0,0,0,0.25)]', PLANNER_SELECTED_RING_CLASS),
                        )}
                      >
                        <RarityFrame
                          imageSrc={`/images/equip/${equipment.imageId}.avif`}
                          title={name}
                          rarity={equipment.rarity}
                          imageClassName="object-cover"
                          className="w-full rounded-lg shadow-none"
                          badges={selected ? <span className={cn('flex size-5 items-center justify-center rounded-full', PLANNER_SELECTED_BADGE_CLASS)}><Check className="size-3" /></span> : undefined}
                          badgeClassName="left-auto right-1.5 top-1.5"
                        />
                      </PlannerPreviewTooltip>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default EquipmentSuitPicker
