'use client'

import { useState, memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import type { SkillDataTable, SkillDataRow } from '@/types/character-guide'

const SKILL_LABELS = ['Lv1', 'Lv2', 'Lv3', 'Lv4', 'Lv5', 'Lv6', 'Lv7', 'Lv8', 'Lv9', 'M1', 'M2', 'M3']

interface SkillTablesProps {
  tables: SkillDataTable[]
  defaultExpanded?: boolean
}

/** Merge consecutive identical values into segments */
function mergeSegments(values: string[]): { value: string; span: number; indices: number[] }[] {
  const segments: { value: string; span: number; indices: number[] }[] = []
  let i = 0
  while (i < values.length) {
    const v = values[i] || '-'
    let span = 1
    const indices = [i]
    while (i + span < values.length && (values[i + span] || '-') === v) {
      indices.push(i + span)
      span++
    }
    segments.push({ value: v, span, indices })
    i += span
  }
  return segments
}

/** Render a single skill data table */
const SkillTable = memo(function SkillTable({
  table,
  expanded,
  onToggle,
}: {
  table: SkillDataTable
  expanded: boolean
  onToggle: () => void
}) {
  const t = useTranslations()

  if (!table.rows.length) return null

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">{table.title}</span>
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-5 text-[11px] px-2 py-0">
          {expanded ? t('charGuide.collapseLevels') : t('charGuide.expandLevels')}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground whitespace-nowrap">
                {t('charGuide.paramName')}
              </th>
              {expanded ? (
                SKILL_LABELS.map((label) => (
                  <th
                    key={label}
                    className="text-right py-1.5 px-1.5 font-medium text-muted-foreground font-geist-mono tracking-tighter tabular-nums"
                  >
                    {label}
                  </th>
                ))
              ) : (
                <th className="text-right py-1.5 px-1.5 font-medium text-muted-foreground font-geist-mono">
                  {t('charGuide.maxLevel')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <SkillRow key={ri} row={row} expanded={expanded} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})

/** Render a single skill data row */
const SkillRow = memo(function SkillRow({
  row,
  expanded,
}: {
  row: SkillDataRow
  expanded: boolean
}) {
  const values = row.values.length === 12 ? row.values : new Array(12).fill('-')

  if (expanded) {
    const segments = mergeSegments(values)
    return (
      <tr className="border-b border-border/20 hover:bg-accent/30">
        <td className="py-1.5 pr-2 whitespace-nowrap font-medium">{row.name}</td>
        {segments.map((seg, si) => (
          <td
            key={si}
            colSpan={seg.span}
            className="text-center py-1.5 px-1 font-geist-mono tracking-tighter tabular-nums whitespace-nowrap border-x border-border/10"
          >
            {seg.value}
          </td>
        ))}
      </tr>
    )
  }

  // Collapsed mode: show only the last (M3) value
  const lastVal = values[values.length - 1] || '-'
  return (
    <tr className="border-b border-border/20 hover:bg-accent/30">
      <td className="py-1.5 pr-2 whitespace-nowrap font-medium">{row.name}</td>
      <td className="text-right py-1.5 px-1.5 font-geist-mono tracking-tighter tabular-nums whitespace-nowrap">
        {lastVal}
      </td>
    </tr>
  )
})

/** Top-level skill tables wrapper with per-table expand toggle */
export const SkillTables = memo(function SkillTables({
  tables,
  defaultExpanded = false,
}: SkillTablesProps) {
  const [localExpanded, setLocalExpanded] = useState<Record<number, boolean>>({})

  const toggleLocal = useCallback((index: number) => {
    setLocalExpanded((prev) => ({ ...prev, [index]: !prev[index] }))
  }, [])

  return (
    <div>
      {tables.map((table, index) => (
        <SkillTable
          key={index}
          table={table}
          expanded={localExpanded[index] ?? defaultExpanded}
          onToggle={() => toggleLocal(index)}
        />
      ))}
    </div>
  )
})
