'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EquipCard } from './equip-card'
import { useRefinementStore } from '@/stores/useRefinementStore'
import type { SlotRecommendation } from '@/types/refinement'
import { ChevronDown } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

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
 * Measure the actual number of grid columns from computed style.
 *
 * Never relies on counting rendered children — the visible child count
 * is itself derived from this function's return value, so child-based
 * counting creates a circular dependency that traps the grid at
 * DEFAULT_COLUMNS forever.
 *
 * Path 1: modern browsers expand auto-fill/auto-fit to explicit track
 *         sizes in the computed value (e.g. "96px 96px 96px 96px").
 * Path 2: if the repeat() syntax is preserved, parse the minmax()
 *         minimum and divide the container width by it.
 */
function getGridColumns(gridEl: HTMLElement | null): number {
  if (!gridEl) return DEFAULT_COLUMNS
  const style = getComputedStyle(gridEl)
  const tpl = style.gridTemplateColumns

  // Path 1 — resolved explicit tracks
  if (tpl && tpl !== 'none' && !tpl.includes('repeat(')) {
    const count = tpl.split(/\s+/).filter(Boolean).length
    if (count > 0) return count
  }

  // Path 2 — repeat() preserved: calculate from minmax() + container width
  const minmaxMatch = tpl?.match(/minmax\(\s*([\d.]+)(px|rem)\s*,/)
  if (minmaxMatch) {
    const value = parseFloat(minmaxMatch[1])
    const minPx = minmaxMatch[2] === 'rem'
      ? value * parseFloat(getComputedStyle(document.documentElement).fontSize)
      : value
    const gap = parseFloat(style.columnGap || style.gap || '0') || 0
    const width = gridEl.clientWidth
    if (minPx > 0 && width > 0) {
      return Math.max(1, Math.floor((width + gap) / (minPx + gap)))
    }
  }

  return DEFAULT_COLUMNS
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

  const isMobile = useIsMobile()

  const isExpanded = expandedRecommendations[slotKey] ?? false

  // ── Dynamic column measurement ──────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)

  // Re-run when the grid is (re)created: the grid div is unmounted when
  // candidates is empty, so without this dep the ResizeObserver stays bound
  // to the stale detached element and resets columns to the default.
  const hasCandidates = candidates.length > 0

  useEffect(() => {
    if (!hasCandidates) return
    const el = gridRef.current
    if (!el) return

    const measure = () => setColumns(getGridColumns(el))
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isMobile, hasCandidates])

  // Collapsed view shows exactly one row (columns count)
  const hasMore = candidates.length > columns
  const visibleCandidates =
    hasMore && !isExpanded ? candidates.slice(0, columns) : candidates

  const handleToggle = useCallback(() => {
    toggleRecommendationExpand(slotKey)
  }, [toggleRecommendationExpand, slotKey])

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header with inline status tip */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
        <h4 className="text-sm font-semibold shrink-0">
          {t(SLOT_LABEL_KEYS[slotKey] || slotKey)}
        </h4>
        {topValueDisplay && (
          <span className="text-xs font-medium text-muted-foreground min-w-0 truncate">
            {targetAttr
              ? `${t('equipStats.' + targetAttr.key)}+${targetAttr.value}${targetAttr.unit}`
              : topValueDisplay}
          </span>
        )}
        {targetAttr && recommendation.hasHigherValues && (
          <span className="text-xs text-muted-foreground">
            {t('refinement.recommendOther')}
          </span>
        )}
        {targetAttr && !recommendation.hasHigherValues && candidates.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('refinement.recommendSelf')}
          </span>
        )}
      </div>

      {/* No target attribute */}
      {!targetAttr && (
        <p className="text-xs text-muted-foreground">
          {t('refinement.missingTargetAttr')}
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
          className={cn(
            'grid gap-1.5',
            isMobile
              ? 'grid-cols-[repeat(auto-fill,minmax(5rem,1fr))]'
              : 'grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]',
          )}
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
                  readOnly
                  badgeValue={`+${c.matchAttr.value}${c.matchAttr.unit}`}
                />
              </div>
              <span className="text-[9px] text-muted-foreground truncate max-w-full text-center leading-none">
                {c.equip.material ? (t(`materials.${c.equip.material}`) ?? c.equip.material) : ''}
                {c.equip.altMaterial ? ` | ${t(`materials.${c.equip.altMaterial}`) ?? c.equip.altMaterial}` : ''}
              </span>
              {(c.equip.voucher || c.equip.altVoucher) && (
                <span className="text-[9px] text-muted-foreground truncate max-w-full text-center leading-none">
                  {c.equip.voucher ? `${t(`materials.${c.equip.voucher.name}`) ?? c.equip.voucher.name}x${c.equip.voucher.count}` : ''}
                  {c.equip.altVoucher ? ` | ${t(`materials.${c.equip.altVoucher.name}`) ?? c.equip.altVoucher.name}x${c.equip.altVoucher.count}` : ''}
                </span>
              )}
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
