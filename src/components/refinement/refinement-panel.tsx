'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SlotRecommendationCard } from './slot-recommendation'
import { useRefinementStore, useSelectedEquip, useRecommendations } from '@/stores/useRefinementStore'
import { materialOptions } from '@/data/equips'
import { useIsMobile } from '@/hooks/use-mobile'
import { withImageCacheVersion } from '@/lib/image-url'
import { WikiMaterialList } from '@/components/shared/wiki-material-list'
import { wikiEquipmentPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import { splitPlannerRecipes } from './equip-card'

// Map Chinese equip types to i18n keys
const TYPE_TO_KEY: Record<string, string> = {
  '配件': 'edc',
  '护手': 'hand',
  '护甲': 'body',
}

export const RefinementPanel = memo(function RefinementPanel() {
  const t = useTranslations()
  const selected = useSelectedEquip()
  const recommendations = useRecommendations()
  const filterMaterial = useRefinementStore((s) => s.filterMaterial)
  const toggleFilter = useRefinementStore((s) => s.toggleFilter)
  const isMobile = useIsMobile()
  const [expandedRecipeEquipId, setExpandedRecipeEquipId] = useState<string | null>(null)
  const selectedWikiPreview = selected ? wikiEquipmentPlannerPreviews[selected.id] : undefined
  const recipeGroups = splitPlannerRecipes(selectedWikiPreview?.craftingRecipes ?? [])
  const defaultRecipe = recipeGroups.featured.find((recipe) => recipe.isDefault)
    ?? recipeGroups.featured[0]
    ?? recipeGroups.other[0]
  const alternativeRecipes = [...recipeGroups.featured, ...recipeGroups.other]
    .filter((recipe) => recipe.chainId !== defaultRecipe?.chainId)
  const showOtherRecipes = selected?.id === expandedRecipeEquipId

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
                {t(`materials.${m}`) ?? m}
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
              <div className={cn('relative shrink-0 rounded-lg border border-border overflow-hidden bg-[url(/images/item-frame-bg.png)] bg-cover bg-center', isMobile ? 'w-20 h-20' : 'w-24 h-24')}>
                {selected.imageId && (
                  <Image
                    src={withImageCacheVersion(`/images/equip/${selected.imageId}.avif`)}
                    alt={t(`equips.${selected.id}`) ?? selected.name}
                    fill
                    sizes={isMobile ? '80px' : '96px'}
                    className="object-cover"
                    unoptimized
                  />
                )}
                <Image
                  src={withImageCacheVersion(`/images/item-band-${selected.rarity}.png`)}
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
                  {t(`equips.${selected.id}`) ?? selected.name}
                </h3>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.type')}
                    </span>
                    <span>{t(`equipTypes.${TYPE_TO_KEY[selected.type] ?? selected.type}`) ?? selected.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.subAttr1')}
                    </span>
                    <span className="font-medium">
                      {selected.sub1 ? `${t('equipStats.' + selected.sub1.key)}+${selected.sub1.value}${selected.sub1.unit}` : t('refinement.none')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.subAttr2')}
                    </span>
                    <span className="font-medium">
                      {selected.sub2 ? `${t('equipStats.' + selected.sub2.key)}+${selected.sub2.value}${selected.sub2.unit}` : t('refinement.none')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 w-14">
                      {t('refinement.specialEffect')}
                    </span>
                    <span className="font-medium">
                      {selected.special ? `${t('equipStats.' + selected.special.key)}+${selected.special.value}${selected.special.unit}` : t('refinement.none')}
                    </span>
                  </div>
                  <div className="mt-1 space-y-2">
                    <span className="text-xs text-muted-foreground">{t('refinement.material')}</span>
                    {defaultRecipe ? (
                      <>
                        <WikiMaterialList materials={defaultRecipe.materials} compact />
                        {alternativeRecipes.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRecipeEquipId(showOtherRecipes ? null : selected.id)}
                            className="h-auto w-full justify-center rounded-md py-1.5 text-[11px]"
                          >
                            <ChevronDown className={cn('transition-transform', showOtherRecipes && 'rotate-180')} />
                            {showOtherRecipes ? t('wiki.hideOtherRecipes') : t('wiki.showOtherRecipes', { count: alternativeRecipes.length })}
                          </Button>
                        ) : null}
                        {showOtherRecipes ? (
                          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {alternativeRecipes.map((recipe) => (
                              <div key={recipe.chainId} className="space-y-2 rounded-md bg-muted/35 p-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-medium">{t('wiki.recipe')} #{recipe.chainId}</span>
                                  {recipe.discount > 0 && recipe.discount < 1 ? (
                                    <Badge variant="secondary" className="text-ship-red">-{Math.round((1 - recipe.discount) * 100)}%</Badge>
                                  ) : null}
                                </div>
                                <WikiMaterialList materials={recipe.materials} compact />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{t(`materials.${selected.material}`) ?? selected.material}</span>
                    )}
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
