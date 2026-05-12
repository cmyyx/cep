'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EquipCard } from './equip-card'
import { useRefinementStore } from '@/stores/useRefinementStore'
import type { SlotRecommendation } from '@/types/refinement'
import { ChevronDown } from 'lucide-react'

const SLOT_LABEL_KEYS: Record<string, string> = {
  sub1: 'refinement.subAttr1',
  sub2: 'refinement.subAttr2',
  special: 'refinement.specialEffect',
}

/** Fallback column count before the grid is measured */
const DEFAULT_COLUMNS = 4

interface SlotRecommendationCardProps {
  recommendation: SlotRecommendation
}

/**
 * Read the actual number of grid columns from computed style.
 * Returns `DEFAULT_COLUMNS` if the grid cannot be measured yet.
 */
function getGridColumns(gridEl: HTMLElement | null): number {
  if (!gridEl) return DEFAULT_COLUMNS
  const style = getComputedStyle(gridEl)
  const tpl = style.gridTemplateColumns || ''
  // grid-template-columns looks like "80px 80px 80px 80px" or "repeat(auto-fill, minmax(80px, 1fr))"
  if (tpl.includes('repeat')) {
    // For repeat(), count actual rendered columns via child positions
    const children = gridEl.children
    if (children.length === 0) return DEFAULT_COLUMNS
    let cols = 1
    const firstTop = (children[0] as HTMLElement).offsetTop
    for (let i = 1; i < children.length; i++) {
      if ((children[i] as HTMLElement).offsetTop > firstTop) break
      cols++
    }
    return cols
  }
  // Static template: count space-separated values
  return tpl.split(' ').filter(Boolean).length || DEFAULT_COLUMNS
}

export const SlotRecommendationCard = memo(function SlotRecommendationCard({
  recommendation,
}: SlotRecommendationCardProps) {
  const t = useTranslations()
  const expandedRecommendations = useRefinementStore(
    (s) => s.expandedRecommendations,
  )
  const toggleRecommendationExpand = useRefinementStore(
    (s) => s.toggleRecommendationExpand,
  )

  const { slotKey, targetAttr, topValueDisplay, candidates } =
    recommendation

  const isExpanded = expandedRecommendations[slotKey] ?? false

  // ── Dynamic column measurement ──────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    const measure = () => setColumns(getGridColumns(el))
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Collapsed view shows exactly one row (columns count)
  const hasMore = candidates.length > columns
  const visibleCandidates =
    hasMore && !isExpanded ? candidates.slice(0, columns) : candidates

  const handleToggle = useCallback(() => {
    toggleRecommendationExpand(slotKey)
  }, [toggleRecommendationExpand, slotKey])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-sm font-semibold truncate">
            {t(SLOT_LABEL_KEYS[slotKey] || slotKey)}
          </h4>
        </div>
        {topValueDisplay && (
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {targetAttr ? targetAttr.display : topValueDisplay}
          </span>
        )}
      </div>

      {/* No target attribute */}
      {!targetAttr && (
        <p className="text-xs text-muted-foreground">
          {t('refinement.missingTargetAttr')}
        </p>
      )}

      {/* Status tip */}
      {targetAttr && recommendation.hasHigherValues && (
        <p className="text-xs text-muted-foreground mb-2">
          {t('refinement.recommendOther')}
        </p>
      )}
      {targetAttr && !recommendation.hasHigherValues && candidates.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          {t('refinement.recommendSelf')}
        </p>
      )}

      {/* Material filter notice */}
      {recommendation.materialFilterNotice === 'noCandidate' && (
        <p className="text-xs text-amber-600 mb-2">
          {t('refinement.materialFilterNoCandidate')}
        </p>
      )}
      {recommendation.materialFilterNotice === 'mayMissBest' && (
        <p className="text-xs text-amber-600 mb-2">
          {t('refinement.materialFilterMayMissBest')}
        </p>
      )}

      {/* Candidate grid */}
      {candidates.length > 0 && (
        <div
          ref={gridRef}
          className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5"
        >
          {visibleCandidates.map((c) => (
            <div
              key={c.equip.id}
              className="flex flex-col gap-0.5 items-center"
            >
              <div className="w-full">
                <EquipCard
                  equip={c.equip}
                  isSelected={false}
                  compact
                  badgeValue={`+${c.matchAttr.value}${c.matchAttr.unit}`}
                />
              </div>
              <span className="text-[9px] text-muted-foreground truncate max-w-full text-center leading-none">
                {c.equip.material}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Expand/collapse button */}
      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="mt-3 h-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              'size-3 transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
          />
          {isExpanded
            ? t('refinement.collapseCandidates')
            : t('refinement.expandCandidates')}
        </Button>
      )}
    </div>
  )
})
