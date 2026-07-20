'use client'

import { memo, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useMobileLongPressTooltip } from '@/hooks/use-mobile-long-press-tooltip'
import { withImageCacheVersion } from '@/lib/image-url'
import { PlannerWikiPreview } from '@/components/shared/planner-wiki-preview'
import type { Equip } from '@/types/refinement'

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
  const displayMaterial = equip.material ? (t(`materials.${equip.material}`) ?? equip.material) : ''
  const displayAltMaterial = equip.altMaterial ? (t(`materials.${equip.altMaterial}`) ?? equip.altMaterial) : ''
  const displayVoucher = equip.voucher ? `${t(`materials.${equip.voucher.name}`) ?? equip.voucher.name}x${equip.voucher.count}` : ''
  const displayAltVoucher = equip.altVoucher ? `${t(`materials.${equip.altVoucher.name}`) ?? equip.altVoucher.name}x${equip.altVoucher.count}` : ''
  const combinedVoucher = [displayVoucher, displayAltVoucher].filter(Boolean).join(' | ')
  const imageSrc = equip.imageId
    ? withImageCacheVersion(`/images/equip/${equip.imageId}.avif`)
    : ''
  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
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
              isMobile && 'touch-manipulation select-none [-webkit-touch-callout:none]',
              readOnly ? 'cursor-default' : 'cursor-pointer',
              isSelected
                ? 'shadow-[0px_0px_0px_1px_#fbbf24,0_25px_50px_-12px_rgba(0,0,0,0.25)] ring-2 ring-amber-400/50 ring-offset-2 ring-offset-background'
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
          <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-amber-400 flex items-center justify-center z-30 shadow-md">
            <Check className="size-3 text-black" strokeWidth={3} />
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className={cn(
        'max-w-[calc(100vw-2rem)] bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)]',
        isMobile ? 'max-w-[calc(100vw-2rem)]' : 'max-w-none',
      )}>
        <PlannerWikiPreview
          title={displayName}
          imageSrc={imageSrc || undefined}
          rarity={equip.rarity}
          rows={[
            ...(equip.sub1 ? [{ label: t(`equipStats.${equip.sub1.key}`), value: `+${equip.sub1.value}${equip.sub1.unit}` }] : []),
            ...(equip.sub2 ? [{ label: t(`equipStats.${equip.sub2.key}`), value: `+${equip.sub2.value}${equip.sub2.unit}` }] : []),
            ...(equip.special ? [{ label: t(`equipStats.${equip.special.key}`), value: `+${equip.special.value}${equip.special.unit}` }] : []),
            ...((displayMaterial || displayAltMaterial || combinedVoucher) ? [{
              label: t('wiki.craftingMaterials'),
              value: <span className="space-y-0.5 text-right">{[displayMaterial, displayAltMaterial, combinedVoucher].filter(Boolean).map((value) => <span key={value} className="block">{value}</span>)}</span>,
            }] : []),
          ]}
          wikiHref={equip.id.startsWith('item_equip_') ? `/${locale}/wiki/equipment/${equip.id}` : undefined}
        />
      </TooltipContent>
    </Tooltip>
  )
})
