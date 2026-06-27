'use client'

import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
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

/** Dismiss tooltip on scroll */
function useCloseOnScroll(open: boolean, setOpen: (open: boolean) => void) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open || !ref.current) return

    const scrollables: HTMLElement[] = []
    let el: HTMLElement | null = ref.current.parentElement
    while (el) {
      const style = window.getComputedStyle(el)
      if (/(auto|scroll)/.test(style.overflow + style.overflowY)) {
        scrollables.push(el)
      }
      el = el.parentElement
    }

    const handler = () => setOpen(false)
    scrollables.forEach((el) => {
      el.addEventListener('scroll', handler, { passive: true })
      el.addEventListener('wheel', handler, { passive: true })
    })
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('wheel', handler, { passive: true })
    document.scrollingElement?.addEventListener('scroll', handler, { passive: true })
    document.scrollingElement?.addEventListener('wheel', handler, { passive: true })
    return () => {
      scrollables.forEach((el) => {
        el.removeEventListener('scroll', handler)
        el.removeEventListener('wheel', handler)
      })
      window.removeEventListener('scroll', handler)
      window.removeEventListener('wheel', handler)
      document.scrollingElement?.removeEventListener('scroll', handler)
      document.scrollingElement?.removeEventListener('wheel', handler)
    }
  }, [open, setOpen])

  return ref
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
  const selectEquip = useRefinementStore((s) => s.selectEquip)
  const [open, setOpen] = useState(false)
  const triggerRef = useCloseOnScroll(open, setOpen)

  const isMobile = useIsMobile()
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  // True from pointerdown until pointerup/cancel — blocks Base UI close while finger is down
  const isPointerDownRef = useRef(false)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // On mobile, prevent Base UI from auto-opening the tooltip (focus/hover),
  // and block close requests while the user's finger is still down.
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (isMobile) {
      if (!nextOpen && isPointerDownRef.current) return
      if (!nextOpen) setOpen(false)
      return
    }
    setOpen(nextOpen)
  }, [isMobile])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isMobile) return
    isPointerDownRef.current = true
    longPressTriggeredRef.current = false
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setOpen(true)
    }, 300)
  }, [isMobile, clearLongPress])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStartRef.current) return
    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearLongPress()
      pointerStartRef.current = null
    }
  }, [clearLongPress])

  const handlePointerEnd = useCallback(() => {
    isPointerDownRef.current = false
    clearLongPress()
    pointerStartRef.current = null
    // If long press was triggered, keep tooltip open — user taps elsewhere / scrolls to dismiss
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
  }, [clearLongPress])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const handleClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    if (readOnly) return
    selectEquip(equip.id)
  }, [selectEquip, equip.id, readOnly])

  const variant = getVariant(equip.name)
  const displayName = t(`equips.${equip.id}`) ?? equip.name
  const displayType = t(`equipTypes.${TYPE_TO_KEY[equip.type] ?? equip.type}`) ?? equip.type
  const displayMaterial = equip.material ? (t(`materials.${equip.material}`) ?? equip.material) : ''
  const imageSrc = equip.imageId
    ? `/images/equip/${equip.imageId}.avif`
    : ''

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger
        render={
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            onClick={handleClick}
            onPointerDown={isMobile ? handlePointerDown : undefined}
            onPointerMove={isMobile ? handlePointerMove : undefined}
            onPointerUp={isMobile ? handlePointerEnd : undefined}
            onPointerCancel={isMobile ? handlePointerEnd : undefined}
            onContextMenu={isMobile ? handleContextMenu : undefined}
            className={cn(
              'group relative flex items-center justify-center aspect-square w-full rounded-lg border-0 overflow-hidden transition-all h-auto px-0',
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
          src={`/images/item-band-${equip.rarity}.png`}
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
        'text-xs text-foreground bg-popover/95',
        isMobile ? 'max-w-[calc(100vw-2rem)]' : 'max-w-none',
      )}>
        <p className="font-semibold whitespace-nowrap">{displayName}</p>
        <p className={cn('text-muted-foreground/80', isMobile ? 'whitespace-normal' : 'whitespace-nowrap')}>
          {equip.sub1 ? `${t('equipStats.' + equip.sub1.key)}+${equip.sub1.value}${equip.sub1.unit}` : ''}
          {equip.sub2 ? ` · ${t('equipStats.' + equip.sub2.key)}+${equip.sub2.value}${equip.sub2.unit}` : ''}
          {equip.special ? ` · ${t('equipStats.' + equip.special.key)}+${equip.special.value}${equip.special.unit}` : ''}
          {displayMaterial ? ` · ${displayMaterial}` : ''}
          {equip.voucher ? ` · ${t(`materials.${equip.voucher.name}`) ?? equip.voucher.name}x${equip.voucher.count}` : ''}
        </p>
      </TooltipContent>
    </Tooltip>
  )
})
