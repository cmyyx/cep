'use client'

import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Weapon } from '@/types/matrix'

/**
 * Dismiss a controlled tooltip when any scrollable ancestor scrolls.
 * This prevents the tooltip from being left behind when the user scrolls
 * the container without moving the mouse — which would otherwise cause
 * the portal-rendered popup to drift outside the viewport and trigger
 * unwanted horizontal scrollbars.
 */
function useCloseOnScroll(
  open: boolean,
  setOpen: (open: boolean) => void,
) {
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
    document.scrollingElement?.addEventListener('scroll', handler, { passive: true })
    return () => {
      scrollables.forEach((el) =>
        el.removeEventListener('scroll', handler),
      )
      window.removeEventListener('scroll', handler)
      document.scrollingElement?.removeEventListener('scroll', handler)
    }
  }, [open, setOpen])

  return ref
}

interface WeaponCardProps {
  weapon: Weapon
  isSelected: boolean
  isOnBanner?: boolean
  disabled?: boolean
}

/**
 * Weapon selection card. Handles toggle internally via the store so the
 * parent does not need to pass an unstable callback — allowing React.memo
 * to skip re-renders for cards whose isSelected hasn't changed.
 */
export const WeaponCard = memo(function WeaponCard({
  weapon,
  isSelected,
  isOnBanner,
  disabled,
}: WeaponCardProps) {
  const toggleWeapon = useMatrixStore((s) => s.toggleWeapon)
  const [open, setOpen] = useState(false)
  const triggerRef = useCloseOnScroll(open, setOpen)

  const handleToggle = useCallback(() => {
    toggleWeapon(weapon.id)
  }, [toggleWeapon, weapon.id])

  const imageSrc = weapon.imageId?.startsWith('data:')
    ? weapon.imageId
    : `/images/weapons/${weapon.imageId || 'wpn_sword_0001'}.avif`

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <button
            ref={triggerRef}
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            className={cn(
              'group relative flex items-center justify-center aspect-square rounded-lg border cursor-pointer overflow-hidden transition-all',
              'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center',
              disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
              !disabled && [
                isSelected
                  ? 'border-amber-400 ring-2 ring-amber-400/50 ring-offset-2 ring-offset-background shadow-2xl'
                  : 'border-border hover:ring-2 hover:ring-white/40',
              ]
            )}
          />
        }
      >
        {/* Weapon art */}
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Image
            src={imageSrc}
            alt={weapon.name}
            fill
            className="object-cover"
            unoptimized
            loading="lazy"
          />
        </div>

        {/* Character avatars */}
        {weapon.chars.length > 0 && (
          <div className="absolute top-2 left-2 flex gap-1 z-20">
            {weapon.chars.map((char) => (
              <div
                key={char}
                className="relative size-8 rounded-full bg-black/60 border border-white/35 shadow-md overflow-hidden"
              >
                <Image
                  src={`/images/characters/${char}.avif`}
                  alt={char}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}

        {/* Rarity band image */}
        <Image
          src={`/images/item-band-${weapon.rarity}.png`}
          alt=""
          width={200}
          height={40}
          className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
          unoptimized
        />

        {/* Weapon name */}
        <div className="absolute bottom-2 left-0 right-0 z-30 px-2 text-center">
          <p className="text-sm leading-tight font-semibold text-stone-100 truncate drop-shadow-md">
            {weapon.name}
          </p>
        </div>

        {/* Banner UP badge — same row as character avatars */}
        {isOnBanner && (
          <div className="absolute top-2 right-0 z-30">
            <Image
              src="/up.png"
              alt="UP"
              width={32}
              height={32}
              className="drop-shadow-md"
              unoptimized
            />
          </div>
        )}

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 size-6 rounded-full bg-amber-400 flex items-center justify-center z-30 shadow-md">
            <span className="text-[10px] text-black font-bold">✓</span>
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-xs text-foreground bg-popover/95"
      >
        <p className="text-muted-foreground/80">
          {weapon.primaryStat} | {weapon.elementalDamage} |{' '}
          {weapon.specialAbility}
        </p>
      </TooltipContent>
    </Tooltip>
  )
})
