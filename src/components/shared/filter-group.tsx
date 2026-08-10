'use client'

import { FilterChip } from '@/components/shared/filter-chip'
import { cn } from '@/lib/utils'

export interface FilterGroupChip {
  key: string
  label: string
  valid: boolean
  selected: boolean
  onToggle: () => void
}

export interface FilterGroupProps {
  /** 组标签 (如 "副属性1")。 */
  label: string
  chips: FilterGroupChip[]
  /** chip 网格类名, 默认 minmax(5.5rem,1fr); 长/短文本组可覆盖。 */
  chipColumnClass?: string
}

/**
 * 单组筛选: 组标签 + FilterChip 网格。
 * 五处筛选共用的统一实现 (见 filter-panel.tsx 的容器)。
 */
export function FilterGroup({
  label,
  chips,
  chipColumnClass = 'grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]',
}: FilterGroupProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className={cn('grid gap-1', chipColumnClass)}>
        {chips.map((chip) => (
          <FilterChip
            key={chip.key}
            value={chip.key}
            label={chip.label}
            isValid={chip.valid}
            isSelected={chip.selected}
            onToggle={chip.onToggle}
          />
        ))}
      </div>
    </div>
  )
}

export default FilterGroup
