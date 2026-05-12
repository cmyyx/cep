'use client'

import { memo, useCallback, useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import type { Equip } from '@/types/refinement'

/** Extract variant suffix from name (e.g. "长息蓄电核·壹型" → "壹型") */
function getVariant(name: string): string | null {
  const idx = name.indexOf('·')
  if (idx === -1 || idx === name.length - 1) return null
  return name.slice(idx + 1)
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
    scrollables.forEach((el) =>
      el.addEventListener('scroll', handler, { passive: true }),
    )
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      scrollables.forEach((el) => el.removeEventListener('scroll', handler))
      window.removeEventListener('scroll', handler)
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
}

export const EquipCard = memo(function EquipCard({
  equip,
  isSelected,
  compact = false,
  badgeValue,
}: EquipCardProps) {
  const selectEquip = useRefinementStore((s) => s.selectEquip)
  const [open, setOpen] = useState(false)
  const triggerRef = useCloseOnScroll(open, setOpen)

  const handleClick = useCallback(() => {
    selectEquip(equip.id)
  }, [selectEquip, equip.id])

  const variant = getVariant(equip.name)
  const imageSrc = equip.imageId
    ? `/images/equip/${equip.imageId}.avif`
    : ''

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            onClick={handleClick}
            className={cn(
              'group relative flex items-center justify-center aspect-square w-full rounded-lg border-0 cursor-pointer overflow-hidden transition-all h-auto px-0',
              'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center',
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
              alt={equip.name}
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
            compact ? 'text-[10px]' : 'text-xs',
          )}>
            {equip.name}
          </p>
        </div>

        {/* Badges: type on top, variant below */}
        <div className="absolute top-1 left-1 z-30 flex flex-col gap-0.5">
          <span className="inline-flex items-center self-start px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/50 text-stone-200 border border-white/15">
            {equip.type}
          </span>
          {variant && (
            <span className="inline-flex items-center self-start px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/80 text-black">
              {variant}
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
      <TooltipContent side="top" className="text-xs text-foreground bg-popover/95 max-w-none">
        <p className="font-semibold whitespace-nowrap">{equip.name}</p>
        <p className="text-muted-foreground/80 whitespace-nowrap">
          {equip.sub1 ? equip.sub1.display : ''}
          {equip.sub2 ? ` · ${equip.sub2.display}` : ''}
          {equip.special ? ` · ${equip.special.display}` : ''}
          {equip.material ? ` · ${equip.material}` : ''}
        </p>
      </TooltipContent>
    </Tooltip>
  )
})
