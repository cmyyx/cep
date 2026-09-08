'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import { getGridColumns } from '@/lib/grid-columns'
import { cn } from '@/lib/utils'
import type { WikiAcquisitionGroup, WikiAcquisitionSourceItem } from '@/types/wiki-acquisition'

/** Fallback column count before the grid is measured. */
const DEFAULT_COLUMNS = 2

/** Card grid — auto-fill so the column count adapts to the visible width. */
const CARD_GRID_CLASS = 'grid gap-2 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]'

/**
 * One acquisition category group. Collapses to the first grid row when the
 * category has more sources than fit into a row — the column count is
 * measured from the rendered grid (same mechanism as the refinement
 * planner's recommendation cards), so "one row" follows the visible width.
 */
function AcquisitionGroup({ label, sources }: { label: string; sources: WikiAcquisitionSourceItem[] }) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)

  const hasSources = sources.length > 0

  // Re-attach the observer whenever the grid is (re)created.
  useEffect(() => {
    if (!hasSources) return
    const el = gridRef.current
    if (!el) return

    const measure = () => setColumns(getGridColumns(el, DEFAULT_COLUMNS))
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasSources])

  const hasMore = sources.length > columns
  const visibleSources = hasMore && !expanded ? sources.slice(0, columns) : sources

  const handleToggle = useCallback(() => setExpanded((value) => !value), [])

  return (
    <div className="space-y-2">
      <h3 className="font-medium">{label}</h3>
      {hasSources && (
        <div ref={gridRef} className={CARD_GRID_CLASS}>
          {visibleSources.map((source, index) => (
            <div key={`${label}:${index}`} className="min-w-0 rounded-md bg-muted/35 p-3">
              <p className="font-medium">{source.name}</p>
              {source.description ? (
                <WikiRichText value={source.description} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
              ) : null}
            </div>
          ))}
        </div>
      )}
      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="w-full justify-center rounded-md bg-muted/35 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <ChevronDown className={cn('size-3 transition-transform duration-200', expanded && 'rotate-180')} />
          {expanded
            ? t('wiki.collapseAcquisitionSources')
            : t('wiki.showMoreAcquisitionSources', { count: sources.length - columns })}
        </Button>
      )}
    </div>
  )
}

/**
 * Acquisition source list, grouped by category. Each group collapses to one
 * width-adaptive row; text is resolved on the server and this island only
 * owns the measure/collapse interaction.
 */
export function WikiAcquisitionList({ groups }: { groups: WikiAcquisitionGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <AcquisitionGroup key={group.categoryId} label={group.label} sources={group.sources} />
      ))}
    </div>
  )
}
