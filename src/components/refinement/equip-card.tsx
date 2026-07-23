'use client'

import { memo, useCallback, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMobileLongPressTooltip } from '@/hooks/use-mobile-long-press-tooltip'
import { withImageCacheVersion } from '@/lib/image-url'
import { PlannerWikiPreview } from '@/components/shared/planner-wiki-preview'
import { WikiMaterialList } from '@/components/shared/wiki-material-list'
import { plainWikiPreviewText } from '@/components/shared/planner-wiki-preview'
import { wikiEquipmentPlannerPreviews } from '@/generated/data/wiki/planner-previews'
import { PLANNER_SELECTED_BADGE_CLASS, PLANNER_SELECTED_RING_CLASS } from '@/lib/planner-selection-styles'
import type { Equip } from '@/types/refinement'
import type { WikiCraftingRecipe } from '@/types/wiki'
import type { TooltipRootChangeEventDetails } from '@base-ui/react/tooltip'

// Map Chinese equip types to i18n keys
const TYPE_TO_KEY: Record<string, string> = {
  '配件': 'edc',
  '护手': 'hand',
  '护甲': 'body',
}

/** Extract variant suffix from name (e.g. "长息蓄电核·壹型" → "壹型") */
function getVariant(name: string): string | null {
  const idx = name.indexOf('·')
  if (idx === -1 || idx === name.length - 1) return null
  return name.slice(idx + 1)
}

/** Map Chinese/JP model number to i18n key */
const MODEL_I18N_MAP: Record<string, string> = {
  '壹型': 'refinement.modelTypeI',
  '贰型': 'refinement.modelTypeII',
  '叁型': 'refinement.modelTypeIII',
  'Ⅰ型': 'refinement.modelTypeI',
  'Ⅱ型': 'refinement.modelTypeII',
  'Ⅲ型': 'refinement.modelTypeIII',
}

export function splitPlannerRecipes(recipes: WikiCraftingRecipe[]) {
  const featured = recipes.filter((recipe) => recipe.isDefault || (recipe.discount > 0 && recipe.discount < 1)).sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
  const featuredIds = new Set(featured.map((recipe) => recipe.chainId))
  return {
    featured,
    other: recipes.filter((recipe) => !featuredIds.has(recipe.chainId)),
  }
}

export function getPlannerStatPreview(
  equip: Pick<Equip, 'sub1' | 'sub2' | 'special'>,
  preview: typeof wikiEquipmentPlannerPreviews[string] | undefined,
  slot: 'sub1' | 'sub2' | 'special',
) {
  const stat = equip[slot]
  if (!stat) return { levelOne: '—', maxLevel: '—' }
  const plannerStats = [equip.sub1, equip.sub2, equip.special].filter(Boolean)
  const statIndex = plannerStats.indexOf(stat)
  const range = statIndex >= 0 ? preview?.stats[statIndex + 1] : undefined
  return {
    levelOne: plainWikiPreviewText(range?.levelOne ?? `+${stat.value}${stat.unit}`),
    maxLevel: plainWikiPreviewText(range?.maxLevel ?? '—'),
  }
}

interface EquipCardProps {
  equip: Equip
  isSelected: boolean
  /** Compact mode for recommendation grid */
  compact?: boolean
  /** Show a value badge on the card (used in recommendation) */
  badgeValue?: string
  /** Read-only mode: no click selection, tooltip only (for recommendation cards) */
  readOnly?: boolean
}

export const EquipCard = memo(function EquipCard({
  equip,
  isSelected,
  compact = false,
  badgeValue,
  readOnly = false,
}: EquipCardProps) {
  const t = useTranslations()
  const locale = useLocale()
  const selectEquip = useRefinementStore((s) => s.selectEquip)
  const {
    open,
    triggerRef,
    handleOpenChange,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleContextMenu,
    swallowLongPressClick,
    isMobile,
  } = useMobileLongPressTooltip()

  const handleClick = useCallback(() => {
    if (swallowLongPressClick()) return
    if (readOnly) return
    selectEquip(equip.id)
  }, [selectEquip, equip.id, readOnly, swallowLongPressClick])

  const variant = getVariant(equip.name)
  const displayName = t(`equips.${equip.id}`) ?? equip.name
  const displayType = t(`equipTypes.${TYPE_TO_KEY[equip.type] ?? equip.type}`) ?? equip.type
  const wikiPreview = wikiEquipmentPlannerPreviews[equip.id]
  const recipeGroups = splitPlannerRecipes(wikiPreview?.craftingRecipes ?? [])
  const [showOtherRecipes, setShowOtherRecipes] = useState(false)
  const recipeToggleRef = useRef<HTMLButtonElement>(null)
  const handleTooltipOpenChange = useCallback((
    nextOpen: boolean,
    details: TooltipRootChangeEventDetails,
  ) => {
    const eventTargetsToggle = details.event?.composedPath().some((target) =>
      target instanceof Element && target.closest('[data-recipe-toggle="true"]')
    ) ?? false
    const toggleHasFocus = recipeToggleRef.current?.contains(document.activeElement)
    if (
      !nextOpen &&
      ((details.reason === 'outside-press' && eventTargetsToggle) ||
        ((details.reason === 'trigger-hover' || details.reason === 'trigger-focus') && toggleHasFocus))
    ) {
      details.cancel()
      return
    }
    handleOpenChange(nextOpen)
  }, [handleOpenChange])
  const toggleOtherRecipes = useCallback(() => {
    setShowOtherRecipes((value) => !value)
  }, [])
  const previewValue = (slot: 'sub1' | 'sub2' | 'special') =>
    getPlannerStatPreview(equip, wikiPreview, slot)
  const previewLabels = wikiPreview?.stats[1] ?? wikiPreview?.stats[0]
  const imageSrc = equip.imageId
    ? withImageCacheVersion(`/images/equip/${equip.imageId}.avif`)
    : ''
  return (
    <Tooltip open={open} onOpenChange={handleTooltipOpenChange} disableHoverablePopup={false}>
      <TooltipTrigger
        render={
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="card"
            onClick={handleClick}
            onPointerDown={isMobile ? handlePointerDown : undefined}
            onPointerMove={isMobile ? handlePointerMove : undefined}
            onPointerUp={isMobile ? handlePointerEnd : undefined}
            onPointerCancel={isMobile ? handlePointerEnd : undefined}
            onContextMenu={isMobile ? handleContextMenu : undefined}
            className={cn(
              'group relative flex items-center justify-center aspect-square w-full rounded-lg border-0 overflow-hidden transition-all',
              'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center',
              isMobile && 'touch-manipulation select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [&_img]:pointer-events-none [&_img]:select-none',
              readOnly ? 'cursor-default' : 'cursor-pointer',
              isSelected
                ? cn('shadow-[0px_0px_0px_1px_#fbbf24,0_25px_50px_-12px_rgba(0,0,0,0.25)]', PLANNER_SELECTED_RING_CLASS)
                : 'shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] hover:ring-2 hover:ring-white/40',
            )}
          />
        }
      >
        {/* Equip image */}
        {imageSrc && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Image
              src={imageSrc}
              alt={displayName}
              fill
              className="object-cover"
              unoptimized
              loading="lazy"
            />
          </div>
        )}

        {/* Rarity band */}
        <Image
          src={withImageCacheVersion(`/images/item-band-${equip.rarity}.png`)}
          alt=""
          width={200}
          height={40}
          className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
          unoptimized
        />

        {/* Equipment name */}
        <div className="absolute bottom-1.5 left-0 right-0 z-30 px-2 text-center">
          <p className={cn(
            'leading-tight font-semibold text-stone-100 truncate drop-shadow-md',
            compact ? (isMobile ? 'text-[10px]' : 'text-xs') : (isMobile ? 'text-xs' : 'text-sm'),
          )}>
            {displayName}
          </p>
        </div>

        {/* Badges: type on top, variant below */}
        <div className="absolute top-1 left-1 z-30 flex flex-col gap-0.5">
          <span className="inline-flex items-center self-start px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/50 text-stone-200 border border-white/15">
            {displayType}
          </span>
          {variant && (
            <span className="inline-flex items-center self-start px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/80 text-black">
              {t(MODEL_I18N_MAP[variant] ?? variant)}
            </span>
          )}
        </div>

        {/* Value badge (for recommendation cards) */}
        {badgeValue && (
          <div className="absolute top-0 right-0 z-30">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-bl-md text-[9px] font-semibold bg-amber-500 text-black">
              {badgeValue}
            </span>
          </div>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div className={cn('absolute top-1.5 right-1.5 size-5 rounded-full flex items-center justify-center z-30 shadow-md', PLANNER_SELECTED_BADGE_CLASS)}>
            <Check className="size-3" strokeWidth={3} />
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side={isMobile ? "bottom" : "top"} sideOffset={8} collisionPadding={16} className={cn(
        'max-h-[min(var(--available-height),calc(100svh-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)]',
        isMobile ? 'max-w-[calc(100vw-2rem)] data-closed:animate-none' : 'max-w-none',
      )}>
        <PlannerWikiPreview
          title={displayName}
          rarity={equip.rarity}
          compact={isMobile}
          levelOneLabel={previewLabels?.levelOneLabel}
          maxLevelLabel={previewLabels?.maxLevelLabel}
          rows={[
            ...(equip.sub1 ? [{ label: t(`equipStats.${equip.sub1.key}`), ...previewValue('sub1') }] : []),
            ...(equip.sub2 ? [{ label: t(`equipStats.${equip.sub2.key}`), ...previewValue('sub2') }] : []),
            ...(equip.special ? [{ label: t(`equipStats.${equip.special.key}`), ...previewValue('special') }] : []),
          ]}
          footer={recipeGroups.featured.length > 0 ? (
            <div className="space-y-2 pt-1">
              <div className={cn('space-y-2', !isMobile && 'max-h-56 overflow-y-auto pr-1')}>
                {[...recipeGroups.featured, ...(showOtherRecipes ? recipeGroups.other : [])].map((recipe) => (
                  <div key={recipe.chainId} className="space-y-2 rounded-md bg-muted/35 p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium">{t('wiki.recipe')} #{recipe.chainId}</span>
                      {recipe.isDefault ? <Badge>{t('wiki.defaultRecipe')}</Badge> : null}
                      {recipe.discount > 0 && recipe.discount < 1 ? (
                        <Badge variant="secondary" className="text-ship-red">-{Math.round((1 - recipe.discount) * 100)}%</Badge>
                      ) : null}
                    </div>
                    <WikiMaterialList materials={recipe.materials} compact />
                  </div>
                ))}
              </div>
              {recipeGroups.other.length > 0 ? (
                <Button
                  data-recipe-toggle="true"
                  type="button"
                  variant="ghost"
                  ref={recipeToggleRef}
                  size="sm"
                  onClick={toggleOtherRecipes}
                  className="w-full justify-center rounded-md"
                >
                  <ChevronDown className={cn('transition-transform', showOtherRecipes && 'rotate-180')} />
                  {showOtherRecipes ? t('wiki.hideOtherRecipes') : t('wiki.showOtherRecipes', { count: recipeGroups.other.length })}
                </Button>
              ) : null}
            </div>
          ) : undefined}
          wikiHref={equip.id.startsWith('item_equip_') ? `/${locale}/wiki/equipment/${equip.id}` : undefined}
        />
      </TooltipContent>
    </Tooltip>
  )
})
