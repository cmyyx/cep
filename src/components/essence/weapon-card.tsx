'use client'

import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Check } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

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
  const t = useTranslations()
  const toggleWeapon = useMatrixStore((s) => s.toggleWeapon)
  const enableTooltip = useEssenceSettingsStore((s) => s.enableTooltipList)
  const [open, setOpen] = useState(false)
  const triggerRef = useCloseOnScroll(open, setOpen)

  const isMobile = useIsMobile()
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // On mobile, prevent Base UI from auto-opening the tooltip (focus/hover),
  // but allow it to close (blur/click-outside) for natural dismissal.
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (isMobile && enableTooltip) {
      if (!nextOpen) setOpen(false)
      return
    }
    setOpen(nextOpen)
  }, [isMobile, enableTooltip])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isMobile || !enableTooltip) return
    longPressTriggeredRef.current = false
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setOpen(true)
    }, 300)
  }, [isMobile, enableTooltip, clearLongPress])

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
    clearLongPress()
    pointerStartRef.current = null
    if (longPressTriggeredRef.current) {
      setOpen(false)
      longPressTriggeredRef.current = false
    }
  }, [clearLongPress])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const handleToggle = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    toggleWeapon(weapon.id)
  }, [toggleWeapon, weapon.id])

  const wid = weapon.id || 'wpn_sword_0001'
  const isCustom = wid.startsWith('custom-')
  const isPreview = wid.startsWith('preview:')
  const imageSrc = (isCustom || isPreview) ? undefined : wid.startsWith('data:')
    ? wid
    : `/images/weapon/${wid}.avif`
  const displayName = (isCustom || isPreview) ? weapon.name : (t(`weapons.${wid}`) ?? weapon.name)

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      onPointerDown={isMobile && enableTooltip ? handlePointerDown : undefined}
      onPointerMove={isMobile && enableTooltip ? handlePointerMove : undefined}
      onPointerUp={isMobile && enableTooltip ? handlePointerEnd : undefined}
      onPointerCancel={isMobile && enableTooltip ? handlePointerEnd : undefined}
      onContextMenu={isMobile && enableTooltip ? handleContextMenu : undefined}
      className={cn(
        'group relative flex items-center justify-center aspect-square rounded-lg border cursor-pointer overflow-hidden transition-all',
        'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center',
        isMobile && enableTooltip && 'touch-manipulation',
        disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
        !disabled && [
          isSelected
            ? 'border-amber-400 ring-2 ring-amber-400/50 ring-offset-2 ring-offset-background shadow-2xl'
            : 'border-border hover:ring-2 hover:ring-white/40',
        ]
      )}
    >
      {/* Weapon art */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        {isCustom || isPreview ? (
          <span className="text-2xl font-bold text-white/50 select-none absolute inset-0 flex items-center justify-center">{weapon.name?.charAt(0) ?? '?'}</span>
        ) : (
          <Image
            src={imageSrc!}
            alt={displayName}
            fill
            className="object-cover"
            unoptimized
            loading="lazy"
          />
        )}
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
          {displayName}
        </p>
      </div>

      {/* Banner UP badge — same row as character avatars */}
      {isOnBanner && (
        <div className="absolute top-2 right-0 z-30">
          <Image
            src="/up.png"
            alt="UP"
            width={132}
            height={60}
            className="w-8 h-auto drop-shadow-md"
            unoptimized
          />
        </div>
      )}

      {/* Preview badge — only when not UP */}
      {!isOnBanner && weapon.source === 'preview' && (
        <div className="absolute top-2 right-0 z-30">
          <Image
            src="/preview.png"
            alt=""
            width={132}
            height={60}
            className="w-8 h-auto drop-shadow-md"
            unoptimized
          />
        </div>
      )}

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 size-6 rounded-full bg-amber-400 flex items-center justify-center z-30 shadow-md">
          <Check className="size-3 text-black" strokeWidth={3} />
        </div>
      )}
    </button>
  )

  if (!enableTooltip) return trigger

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger render={trigger} />
      <TooltipContent
        side="top"
        className="text-xs text-foreground bg-popover/95"
      >
        <p className="text-muted-foreground/80">
          {t('weaponStats.' + weapon.primaryStat)} |{' '}
          {t('weaponStats.' + weapon.elementalDamage)} |{' '}
          {t('weaponStats.' + weapon.specialAbility)}
        </p>
      </TooltipContent>
    </Tooltip>
  )
})
