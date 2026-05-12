'use client'

import { memo } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SlotRecommendationCard } from './slot-recommendation'
import { useRefinementStore, useSelectedEquip, useRecommendations } from '@/stores/useRefinementStore'
import { materialOptions } from '@/data/equips'

export const RefinementPanel = memo(function RefinementPanel() {
  const t = useTranslations()
  const selected = useSelectedEquip()
  const recommendations = useRecommendations()
  const filterMaterial = useRefinementStore((s) => s.filterMaterial)
  const toggleFilter = useRefinementStore((s) => s.toggleFilter)

  return (
    <div className="flex flex-col gap-4">
      {/* Material filter */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t('refinement.materialFilters')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {materialOptions.map((m) => {
            const isSelected = filterMaterial.includes(m)
            return (
              <Button
                key={m}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => toggleFilter('material', m)}
                aria-pressed={isSelected}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] text-center border transition-colors bg-muted/60 h-auto min-h-0',
                  isSelected &&
                    'bg-primary text-primary-foreground border-primary',
                  !isSelected &&
                    'border-border hover:border-foreground/40 hover:bg-muted/80',
                )}
              >
                {m}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {!selected && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          {t('refinement.selectOneEquip')}
        </div>
      )}

      {/* Selected equip display */}
      {selected && (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-4">
              {/* Equip thumbnail */}
              <div className="relative w-20 h-20 shrink-0 rounded-lg border border-border overflow-hidden bg-[url(/images/item-frame-bg.png)] bg-cover bg-center">
                {selected.imageId && (
                  <Image
                    src={`/images/equip/${selected.imageId}.avif`}
                    alt={selected.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                )}
                <Image
                  src={`/images/item-band-${selected.rarity}.png`}
                  alt=""
                  width={200}
                  height={40}
                  className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
                  unoptimized
                />
              </div>

              {/* Attributes */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold truncate mb-2">
                  {selected.name}
                </h3>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.type')}
                    </span>
                    <span>{selected.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.subAttr1')}
                    </span>
                    <span className="font-medium">
                      {selected.sub1 ? selected.sub1.display : t('refinement.none')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.subAttr2')}
                    </span>
                    <span className="font-medium">
                      {selected.sub2 ? selected.sub2.display : t('refinement.none')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.specialEffect')}
                    </span>
                    <span className="font-medium">
                      {selected.special ? selected.special.display : t('refinement.none')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.material')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {selected.material}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="flex flex-col gap-3">
            {recommendations.map((rec) => (
              <SlotRecommendationCard
                key={rec.slotKey}
                recommendation={rec}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
})
