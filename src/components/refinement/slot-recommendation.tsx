'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { getGridColumns } from '@/lib/grid-columns'
import { Button } from '@/components/ui/button'
import { EquipCard, getLatestCraftingRecipe } from './equip-card'
import { useRefinementStore } from '@/stores/useRefinementStore'
import type { SlotRecommendation } from '@/types/refinement'
import { ChevronDown } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { WikiMaterialList } from '@/components/shared/wiki-material-list'
import { wikiEquipmentPlannerPreviews } from '@/generated/data/wiki/planner-previews'

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

    const measure = () => setColumns(getGridColumns(el, DEFAULT_COLUMNS))
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
              {(() => {
                const preview = wikiEquipmentPlannerPreviews[c.equip.id]
                const latestRecipe = getLatestCraftingRecipe(preview?.craftingRecipes ?? [])
                return latestRecipe ? (
                  <WikiMaterialList materials={latestRecipe.materials} compact iconOnly className="grid w-full grid-cols-2 gap-2" />
                ) : null
              })()}
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
          className="mt-3 min-h-9 w-full justify-center gap-1 rounded-md bg-muted/35 px-3 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
