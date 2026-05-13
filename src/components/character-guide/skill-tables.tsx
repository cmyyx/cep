'use client'

import { useState, memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SkillDataTable, SkillDataRow } from '@/types/character-guide'

const SKILL_LABELS = ['Lv1', 'Lv2', 'Lv3', 'Lv4', 'Lv5', 'Lv6', 'Lv7', 'Lv8', 'Lv9', 'M1', 'M2', 'M3']

interface SkillTablesProps {
  tables: SkillDataTable[]
  defaultExpanded?: boolean
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
    <div className="mt-2 max-w-full">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">{table.title}</span>
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-5 text-[11px] px-2 py-0">
          {expanded ? t('charGuide.collapseLevels') : t('charGuide.expandLevels')}
        </Button>
      </div>
      <div className="overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left py-1 pr-3 font-medium text-muted-foreground whitespace-nowrap">
                {t('charGuide.paramName')}
              </th>
              {expanded ? (
                SKILL_LABELS.map((label) => (
                  <th
                    key={label}
                    className="text-right font-medium text-muted-foreground font-geist-mono whitespace-nowrap py-1 px-1 tracking-tighter tabular-nums"
                  >
                    {label}
                  </th>
                ))
              ) : (
                <th className="text-right font-medium text-muted-foreground font-geist-mono whitespace-nowrap py-1 px-1 tracking-tighter tabular-nums">
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

  return (
    <tr className="border-b border-border/20 hover:bg-accent/30">
      <td className="py-1 pr-3 whitespace-nowrap font-medium">{row.name}</td>
      {expanded ? (
        values.map((val, i) => (
          <td
            key={i}
            className="text-right font-geist-mono tracking-tighter tabular-nums whitespace-nowrap py-1 px-0.5 border-x border-border/10"
          >
            {val || '-'}
          </td>
        ))
      ) : (
        <td className="text-right font-geist-mono tracking-tighter tabular-nums whitespace-nowrap py-1 px-0.5 border-x border-border/10">
          {values[values.length - 1] || '-'}
        </td>
      )}
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
