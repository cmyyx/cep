'use client'

import { memo, useMemo, useCallback, useState, useRef, useEffect, useLayoutEffect } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { DungeonPlan, WeaponMatch } from '@/lib/planner/essence-solver'
import { useMatrixStore, getPlanKey } from '@/stores/useMatrixStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { useBannerStore } from '@/stores/useBannerStore'
import { OwnershipBadge, EditableNote } from '@/components/essence/ownership-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { computeEffectiveS1 } from '@/lib/planner/s1-utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface DungeonCardProps {
  plan: DungeonPlan
  isExpanded: boolean
}

// ─── Memoised sub-components (prevent thumbnail re-renders when only
//     one weapon's isSelected changes within a DungeonCard) ──────────

interface ThumbProps {
  weapon: WeaponMatch['weapon']
  isSelected: boolean
  inRange: boolean
}

function weaponImageSrc(id?: string): string | undefined {
  if (!id || id.startsWith('custom-') || id.startsWith('preview:')) return undefined
  if (id.startsWith('data:')) return id
  return `/images/weapon/${id}.avif`
}

interface RowProps extends ThumbProps {
  selectedLabel: string
  notAvailableLabel: string
  weaponOwnershipLabel: string
  essenceOwnershipLabel: string
  showOwnership?: boolean
  weaponOwned?: boolean
  essenceOwned?: boolean
  note?: string
  fallbackLevel?: number
  onToggleWeaponOwned?: () => void
  onToggleEssenceOwned?: () => void
  onNoteChange?: (value: string) => void
}

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

const WeaponThumbnail = memo(function WeaponThumbnail({
  weapon,
  isSelected,
  inRange,
}: ThumbProps) {
  const t = useTranslations()
  const enableTooltip = useEssenceSettingsStore((s) => s.enableTooltipPlans)
  const toggleWeapon = useMatrixStore((s) => s.toggleWeapon)
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

  useEffect(() => {
    return () => clearLongPress()
  }, [clearLongPress])

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
      // Do NOT reset longPressTriggeredRef here — let handleToggle consume it
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

  const weaponName = (weapon.id?.startsWith('custom-') || weapon.id?.startsWith('preview:')) ? weapon.name : (t(`weapons.${weapon.id}`) ?? weapon.name)

  const thumb = (
    <Button
      variant="ghost"
      size="icon"
      ref={triggerRef}
      onClick={handleToggle}
      onPointerDown={isMobile && enableTooltip ? handlePointerDown : undefined}
      onPointerMove={isMobile && enableTooltip ? handlePointerMove : undefined}
      onPointerUp={isMobile && enableTooltip ? handlePointerEnd : undefined}
      onPointerCancel={isMobile && enableTooltip ? handlePointerEnd : undefined}
      onContextMenu={isMobile && enableTooltip ? handleContextMenu : undefined}
      className={cn(
        'relative w-16 h-16 rounded-md overflow-hidden select-none',
        isMobile && enableTooltip ? 'cursor-default' : 'cursor-pointer',
        'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center',
        isMobile && enableTooltip && 'touch-manipulation',
        inRange && isSelected && 'shadow-[0_0_0_1px_rgba(251,191,36,0.5)]',
        inRange && !isSelected && 'shadow-[0_0_0_1px_rgba(0,0,0,0.08)]',
        !inRange && isSelected && 'shadow-[0_0_0_1px_rgba(251,191,36,0.2)] opacity-40',
        !inRange && !isSelected && 'shadow-[0_0_0_1px_rgba(0,0,0,0.04)] opacity-30',
      )}
    >
      {(() => { const s = weaponImageSrc(weapon.id); if (!s) return <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white/40">{weapon.name?.charAt(0) ?? '?'}</span>; return <Image src={s} alt={weaponName} fill className="object-cover z-10" unoptimized /> })()}
      <Image
        src={`/images/item-band-${weapon.rarity}.png`}
        alt=""
        width={200}
        height={10}
        className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
        unoptimized
      />
      {isSelected && (
        <div className="absolute top-0 right-0 size-4 bg-amber-400 rounded-bl-sm flex items-center justify-center z-30">
          <Check className="size-2.5 text-black" strokeWidth={3} />
        </div>
      )}
    </Button>
  )

  if (!enableTooltip) return thumb

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger render={thumb} />
      <TooltipContent
        side="top"
        className="text-xs text-foreground bg-popover/95"
      >
        <p className={cn('font-semibold', !inRange && 'line-through')}>
          {weaponName}
        </p>
        <p className="text-muted-foreground/80">
          {t('weaponStats.' + weapon.primaryStat)} |{' '}
          {t('weaponStats.' + weapon.elementalDamage)} |{' '}
          {t('weaponStats.' + weapon.specialAbility)}
        </p>
      </TooltipContent>
    </Tooltip>
  )
})

const WeaponRow = memo(function WeaponRow({
  weapon,
  isSelected,
  inRange,
  selectedLabel,
  notAvailableLabel,
  weaponOwnershipLabel,
  essenceOwnershipLabel,
  showOwnership,
  weaponOwned,
  essenceOwned,
  note,
  fallbackLevel,
  onToggleWeaponOwned,
  onToggleEssenceOwned,
  onNoteChange,
}: RowProps) {
  const t = useTranslations()
  const toggleWeapon = useMatrixStore((s) => s.toggleWeapon)
  const weaponName = (weapon.id?.startsWith('custom-') || weapon.id?.startsWith('preview:')) ? weapon.name : (t(`weapons.${weapon.id}`) ?? weapon.name)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm',
        !inRange && !isSelected && 'opacity-30',
        !inRange && isSelected && 'opacity-40 bg-amber-500/3',
        inRange && isSelected && 'bg-amber-500/5',
        inRange && !isSelected && 'hover:bg-muted/30',
      )}
    >
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleWeapon(weapon.id)}
          className="relative size-10 rounded shadow-[0_0_0_1px_rgba(0,0,0,0.08)] bg-muted/30 flex-shrink-0 overflow-hidden bg-[url(/images/item-frame-bg.png)] bg-cover bg-center cursor-pointer">
          {(() => { const s = weaponImageSrc(weapon.id); if (!s) return <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white/40">{weapon.name?.charAt(0) ?? '?'}</span>; return <Image src={s} alt={weaponName} fill className="object-cover z-10" unoptimized /> })()}
          <Image
            src={`/images/item-band-${weapon.rarity}.png`}
            alt=""
            width={200}
            height={8}
            className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
            unoptimized
          />
        </Button>
        <span
          className={cn(
            'font-medium min-w-0 truncate w-28 flex-shrink-0',
            !inRange && 'line-through',
            inRange && isSelected && 'text-amber-400',
          )}
        >
          {weaponName}
        </span>
      </div>
      {/* Level 0 — align mode: all items on one row, attrs width uniform */}
      {fallbackLevel === 0 && (
        <>
          <span
            className="text-xs text-muted-foreground min-w-0 truncate shrink-0"
            style={{ width: 'var(--max-attr-width)' } as React.CSSProperties}
          >
            {t('weaponStats.' + weapon.primaryStat)} |{' '}
            {t('weaponStats.' + weapon.elementalDamage)} |{' '}
            {t('weaponStats.' + weapon.specialAbility)}
          </span>
          {(showOwnership || onNoteChange || (note && !onNoteChange)) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {showOwnership && (
                <>
                  <span className="min-w-[56px] inline-flex justify-center">
                    <OwnershipBadge
                      active={weaponOwned === true}
                      onToggle={() => onToggleWeaponOwned?.()}
                      label={weaponOwnershipLabel}
                      activeColor="emerald"
                    />
                  </span>
                  <span className="min-w-[56px] inline-flex justify-center">
                    <OwnershipBadge
                      active={essenceOwned === true}
                      onToggle={() => onToggleEssenceOwned?.()}
                      label={essenceOwnershipLabel}
                      activeColor="sky"
                    />
                  </span>
                </>
              )}
              {onNoteChange && (
                <div className="w-16 flex-shrink-0">
                  <EditableNote
                    note={note || ''}
                    onSave={onNoteChange}
                  />
                </div>
              )}
              {!onNoteChange && note && (
                <span className="text-[10px] text-muted-foreground truncate max-w-16 flex-shrink-0">
                  {note}
                </span>
              )}
            </div>
          )}
          <span className="ml-auto text-[10px] font-semibold flex-shrink-0 min-w-12 text-right">
            {inRange && isSelected && (
              <span className="text-amber-400">{selectedLabel}</span>
            )}
            {!inRange && isSelected && (
              <span className="text-muted-foreground">{notAvailableLabel}</span>
            )}
          </span>
        </>
      )}
      {/* Level 1 — two-line: icon+name+attrs on line 1, ownership+label unified on line 2 */}
      {fallbackLevel === 1 && (
        <>
          <span className="text-xs text-muted-foreground min-w-0 truncate">
            {t('weaponStats.' + weapon.primaryStat)} |{' '}
            {t('weaponStats.' + weapon.elementalDamage)} |{' '}
            {t('weaponStats.' + weapon.specialAbility)}
          </span>
          <div className="basis-full flex-shrink-0 flex items-center gap-x-3">
            {(showOwnership || onNoteChange || (note && !onNoteChange)) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {showOwnership && (
                  <>
                    <span className="min-w-[56px] inline-flex justify-center">
                      <OwnershipBadge
                        active={weaponOwned === true}
                        onToggle={() => onToggleWeaponOwned?.()}
                        label={weaponOwnershipLabel}
                        activeColor="emerald"
                      />
                    </span>
                    <span className="min-w-[56px] inline-flex justify-center">
                      <OwnershipBadge
                        active={essenceOwned === true}
                        onToggle={() => onToggleEssenceOwned?.()}
                        label={essenceOwnershipLabel}
                        activeColor="sky"
                      />
                    </span>
                  </>
                )}
                {onNoteChange && (
                  <div className="w-16 flex-shrink-0">
                    <EditableNote
                      note={note || ''}
                      onSave={onNoteChange}
                    />
                  </div>
                )}
                {!onNoteChange && note && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-16 flex-shrink-0">
                    {note}
                  </span>
                )}
              </div>
            )}
            <span className="ml-auto text-[10px] font-semibold flex-shrink-0 min-w-12 text-right">
              {inRange && isSelected && (
                <span className="text-amber-400">{selectedLabel}</span>
              )}
              {!inRange && isSelected && (
                <span className="text-muted-foreground">{notAvailableLabel}</span>
              )}
            </span>
          </div>
        </>
      )}
      {/* Level 2 — three-line: vertical stack, icon+name → attrs → ownership+label */}
      {fallbackLevel === 2 && (
        <div className="basis-full flex-shrink-0 flex flex-col gap-y-1">
          <span className="text-xs text-muted-foreground min-w-0 truncate">
            {t('weaponStats.' + weapon.primaryStat)} |{' '}
            {t('weaponStats.' + weapon.elementalDamage)} |{' '}
            {t('weaponStats.' + weapon.specialAbility)}
          </span>
          <div className="flex items-center gap-x-3">
            {(showOwnership || onNoteChange || (note && !onNoteChange)) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {showOwnership && (
                  <>
                    <span className="min-w-[56px] inline-flex justify-center">
                      <OwnershipBadge
                        active={weaponOwned === true}
                        onToggle={() => onToggleWeaponOwned?.()}
                        label={weaponOwnershipLabel}
                        activeColor="emerald"
                      />
                    </span>
                    <span className="min-w-[56px] inline-flex justify-center">
                      <OwnershipBadge
                        active={essenceOwned === true}
                        onToggle={() => onToggleEssenceOwned?.()}
                        label={essenceOwnershipLabel}
                        activeColor="sky"
                      />
                    </span>
                  </>
                )}
                {onNoteChange && (
                  <div className="w-16 flex-shrink-0">
                    <EditableNote
                      note={note || ''}
                      onSave={onNoteChange}
                    />
                  </div>
                )}
                {!onNoteChange && note && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-16 flex-shrink-0">
                    {note}
                  </span>
                )}
              </div>
            )}
            <span className="ml-auto text-[10px] font-semibold flex-shrink-0 min-w-12 text-right">
              {inRange && isSelected && (
                <span className="text-amber-400">{selectedLabel}</span>
              )}
              {!inRange && isSelected && (
                <span className="text-muted-foreground">{notAvailableLabel}</span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})

/**
 * Dungeon plan card.
 *
 * Handles its own expand/collapse toggle internally (reads from the store)
 * so the parent does not need to pass an unstable callback that would
 * defeat React.memo.
 */
export const DungeonCard = memo(function DungeonCard({
  plan,
  isExpanded,
}: DungeonCardProps) {
  const t = useTranslations()
  const dungeonS1Selections = useMatrixStore((s) => s.dungeonS1Selections)
  const setDungeonS1Selection = useMatrixStore((s) => s.setDungeonS1Selection)
  const toggleDungeonExpand = useMatrixStore((s) => s.toggleDungeonExpand)
  const planKey = getPlanKey(plan)

  // Plan-side settings
  const hideFourStar = useEssenceSettingsStore((s) => s.hideFourStarWeaponsPlans)
  const hideUnowned = useEssenceSettingsStore((s) => s.hideUnownedWeaponsPlans)
  const hideEssenceOwned = useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsPlans)
  const onlyBothOwned = useEssenceSettingsStore((s) => s.onlyHideWhenBothOwned)
  const showOwnership = useEssenceSettingsStore((s) => s.enableOwnershipEditPlans)
  const showNotes = useEssenceSettingsStore((s) => s.enableNotesPlans)
  const weaponOwnership = useEssenceSettingsStore((s) => s.weaponOwnership)
  const essenceStatus = useEssenceSettingsStore((s) => s.essenceStatus)
  const weaponNotes = useEssenceSettingsStore((s) => s.weaponNotes)
  const setWeaponOwnership = useEssenceSettingsStore((s) => s.setWeaponOwnership)
  const setEssenceStatus = useEssenceSettingsStore((s) => s.setEssenceStatus)
  const setWeaponNote = useEssenceSettingsStore((s) => s.setWeaponNote)
  const keepUpVisible = useEssenceSettingsStore((s) => s.keepUpVisiblePlans)
  const upCharacterNames = useBannerStore((s) => s.upCharacterNames)
  const upCharSet = useMemo(() => new Set(upCharacterNames), [upCharacterNames])

  const handleToggleExpand = useCallback(() => {
    toggleDungeonExpand(planKey)
  }, [toggleDungeonExpand, planKey])

  // Filter matchedWeapons based on plan-side hide settings
  const visibleMatched = useMemo(() => {
    return plan.matchedWeapons.filter(({ weapon }) => {
      if (keepUpVisible && (weapon.chars.some((c) => upCharSet.has(c)) || weapon.source === 'preview')) return true
      if (hideFourStar && weapon.rarity === 4) return false
      if (hideUnowned && weaponOwnership[weapon.id] !== true) return false
      if (hideEssenceOwned) {
        const eOwned = essenceStatus[weapon.id] === true
        const wOwned = weaponOwnership[weapon.id] === true
        if (onlyBothOwned) {
          if (eOwned && wOwned) return false
        } else {
          if (eOwned) return false
        }
      }
      return true
    })
  }, [
    plan.matchedWeapons,
    keepUpVisible, upCharSet,
    hideFourStar, hideUnowned, hideEssenceOwned, onlyBothOwned,
    weaponOwnership, essenceStatus,
  ])

  const visibleTotal = visibleMatched.length

  // S1 candidate counts based on visible weapons only (respects hide settings)
  const visibleS1Counts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { weapon } of visibleMatched) {
      counts[weapon.primaryStat] = (counts[weapon.primaryStat] || 0) + 1
    }
    return counts
  }, [visibleMatched])

  // Visible S1 candidates (filter out those with 0 visible weapons)
  const visibleS1Candidates = useMemo(() => {
    return plan.s1Candidates.filter((s1) => (visibleS1Counts[s1] || 0) > 0)
  }, [plan.s1Candidates, visibleS1Counts])

  // Effective S1: filter against visible candidates so hidden-weapon stats
  // never linger as "selected" when they have no visible weapons.
  const effectiveS1 = useMemo(() => {
    return computeEffectiveS1(
      dungeonS1Selections[planKey],
      plan.selectedS1,
      visibleS1Candidates,
    )
  }, [plan.selectedS1, planKey, dungeonS1Selections, visibleS1Candidates])

  // Whether the S1 picker is needed (based on visible candidates, not solver's
  // original count which may include now-hidden weapons)
  const visibleNeedsS1Choice = visibleS1Candidates.length > 3

  // Count selected weapons that are both visible and in S1 range
  const visibleSelected = useMemo(() => {
    return visibleMatched.filter(
      (m) => m.isSelected && effectiveS1.includes(m.weapon.primaryStat),
    ).length
  }, [visibleMatched, effectiveS1])

  const lockLabel = plan.lockType === 's2' ? t('essence.lockS2') : t('essence.lockS3')

  // ── Column alignment measurement ──────────────────────────────────────
  // Renders a hidden mirror of each WeaponRow to measure actual pixel
  // widths. Three fallback levels based on how much fits:
  //   0 = full row fits → align mode (attrs get uniform width)
  //   1 = icon+name+attrs fits, ownership doesn't → two-line mode
  //   2 = icon+name+attrs overflows → three-line vertical stack
  const rowContainerRef = useRef<HTMLDivElement>(null)
  const rowMeasureRef = useRef<HTMLDivElement>(null)
  const [fallbackLevel, setFallbackLevel] = useState(0)
  const [maxAttrWidth, setMaxAttrWidth] = useState(0)

  const recomputeAlign = useCallback(() => {
    const container = rowContainerRef.current
    const measure = rowMeasureRef.current
    if (!container || !measure) return
    const availW = container.clientWidth - 24 // px-3 on WeaponRow
    const rows = measure.children
    let maxRowW = 0
    let maxAttrW = 0
    let maxIconAttrW = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLElement
      maxRowW = Math.max(maxRowW, row.scrollWidth)
      // Mirror row children: [0]=icon+name wrapper, [1]=attrs span
      const attrEl = row.children[1] as HTMLElement | undefined
      const iconNameEl = row.children[0] as HTMLElement | undefined
      if (attrEl) maxAttrW = Math.max(maxAttrW, attrEl.scrollWidth)
      if (iconNameEl && attrEl) {
        // 12px = gap-x-3 between icon+name and attrs
        maxIconAttrW = Math.max(maxIconAttrW, iconNameEl.scrollWidth + 12 + attrEl.scrollWidth)
      }
    }
    if (maxRowW <= 0) return
    if (maxRowW <= availW) {
      setFallbackLevel(0)
    } else if (maxIconAttrW <= availW) {
      setFallbackLevel(1)
    } else {
      setFallbackLevel(2)
    }
    // +4 buffer: scrollWidth returns integer (floor), actual text may need
    // up to 1 more subpixel px. 4 px gives breathing room without visible waste.
    if (maxAttrW > 0) setMaxAttrWidth(maxAttrW + 4)
  }, [])

  useLayoutEffect(() => {
    if (!isExpanded) return
    recomputeAlign()
  }, [isExpanded, visibleMatched, showOwnership, showNotes, recomputeAlign])

  useEffect(() => {
    const container = rowContainerRef.current
    if (!isExpanded || !container) return
    const ro = new ResizeObserver(() => recomputeAlign())
    ro.observe(container)
    return () => ro.disconnect()
  }, [isExpanded, recomputeAlign])

  // Don't render when:
  // - all weapons are hidden by hide filters (visibleTotal === 0)
  // - the plan has selected weapons but none survive hide filters —
  //   showing only unselected weapons (e.g. selecting 扶摇 but seeing
  //   only 楔子) is confusing and misleading.
  const hasAnySelected = plan.matchedWeapons.some((m) => m.isSelected)
  const hasVisibleSelected = visibleMatched.some((m) => m.isSelected)
  if (visibleTotal === 0 || (hasAnySelected && !hasVisibleSelected)) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{t(`dungeons.${plan.dungeon.id}`) ?? plan.dungeon.name}</h3>
          {visibleSelected > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600">
              {visibleSelected}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {t('essence.selected')}:{' '}
            <strong className="text-foreground">{visibleSelected}</strong>
          </span>
          <span>
            {t('essence.total')}:{' '}
            <strong className="text-foreground">{visibleTotal}</strong>{' '}
            {t('essence.weaponUnit')}
          </span>
        </div>
      </div>

      {/* Lock condition */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
        <span>
          {t('essence.primaryStatLabel')}: [
          {effectiveS1.map((s, i) => (
            <span key={s}>
              <strong className="text-foreground">{t('gemStats.' + s)}</strong>
              {i < effectiveS1.length - 1 ? ', ' : ''}
            </span>
          ))}
          ]
        </span>
        <span className="text-muted-foreground/50">|</span>
        <span>
          {lockLabel}:{' '}
          <strong className="text-foreground">{t('gemStats.' + plan.lockValue)}</strong>
        </span>
      </div>

      {/* S1 Picker */}
      {visibleNeedsS1Choice && (
        <div className="mb-3 p-3 rounded-md border border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-amber-600 mb-2">
            {t('essence.s1PickerHint', { candidates: visibleS1Candidates.length })}
          </p>
          <div className="flex flex-wrap gap-3">
            {[...visibleS1Candidates]
              .sort(
                (a, b) =>
                  (visibleS1Counts[b] || 0) -
                  (visibleS1Counts[a] || 0)
              )
              .map((s1) => {
                const wCount = visibleS1Counts[s1] || 0
                const isSelected = effectiveS1.includes(s1)
                const isFull = effectiveS1.length >= 3 && !isSelected
                return (
                  <label
                    key={s1}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      isFull
                        ? 'cursor-not-allowed opacity-40'
                        : 'cursor-pointer'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isFull}
                      onCheckedChange={(checked) => {
                        if (checked && effectiveS1.length >= 3) return
                        setDungeonS1Selection(
                          planKey,
                          checked
                            ? [...effectiveS1, s1]
                            : effectiveS1.filter((s) => s !== s1)
                        )
                      }}
                    />
                    {t('gemStats.' + s1)} ({t('essence.weaponCount', { count: wCount })})
                  </label>
                )
              })}
          </div>
        </div>
      )}

      {/* Thumbnails (collapsed) or Rows (expanded) */}
      {!isExpanded ? (
        <div key="collapsed" className="flex flex-wrap gap-2">
          {visibleMatched.map(({ weapon, isSelected }) => (
            <div key={weapon.id} className="flex flex-col gap-0.5 items-center">
              <WeaponThumbnail
                weapon={weapon}
                isSelected={isSelected}
                inRange={effectiveS1.includes(weapon.primaryStat)}
              />
              {showOwnership && (
                <div className="flex items-center gap-0.5">
                  <OwnershipBadge
                    compact
                    active={weaponOwnership[weapon.id] === true}
                    onToggle={() =>
                      setWeaponOwnership(weapon.id, !weaponOwnership[weapon.id])
                    }
                    label={t('essence.weaponOwnershipLabel')}
                    activeColor="emerald"
                  />
                  <OwnershipBadge
                    compact
                    active={essenceStatus[weapon.id] === true}
                    onToggle={() =>
                      setEssenceStatus(weapon.id, !essenceStatus[weapon.id])
                    }
                    label={t('essence.essenceOwnershipLabel')}
                    activeColor="sky"
                  />
                </div>
              )}
              {showNotes && (
                <div className="w-16">
                  <EditableNote
                    note={weaponNotes[weapon.id] || ''}
                    onSave={(value) => setWeaponNote?.(weapon.id, value)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div key="expanded" className="animate-in slide-in-from-top-2 duration-200 [animation-fill-mode:backwards]">
          {/* Hidden measurement rows — mirror the WeaponRow structure exactly
               so measured scrollWidth reflects real pixel widths with zero estimation */}
          <div ref={rowMeasureRef} aria-hidden className="absolute invisible pointer-events-none h-0 overflow-hidden">
            {visibleMatched.map(({ weapon }) => {
              const weaponName = (weapon.id?.startsWith('custom-') || weapon.id?.startsWith('preview:')) ? weapon.name : (t(`weapons.${weapon.id}`) ?? weapon.name)
              return (
              <div key={weapon.id} className="flex flex-wrap items-center gap-x-3 px-3 py-2 text-sm whitespace-nowrap">
                <div className="flex items-center gap-2 min-w-0 shrink-0">
                  <div className="size-10 flex-shrink-0" />
                  <span className="font-medium min-w-0 truncate w-28 flex-shrink-0">{weaponName}</span>
                </div>
                <span className="text-xs text-muted-foreground min-w-0">
                  {t('weaponStats.' + weapon.primaryStat)} |{' '}
                  {t('weaponStats.' + weapon.elementalDamage)} |{' '}
                  {t('weaponStats.' + weapon.specialAbility)}
                </span>
                {(showOwnership || showNotes) && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {showOwnership && (
                      <>
                        <span className="min-w-[56px] inline-flex justify-center">
                          <OwnershipBadge active={false} onToggle={() => {}} label={t('essence.weaponOwnershipLabel')} activeColor="emerald" tabIndex={-1} />
                        </span>
                        <span className="min-w-[56px] inline-flex justify-center">
                          <OwnershipBadge active={false} onToggle={() => {}} label={t('essence.essenceOwnershipLabel')} activeColor="sky" tabIndex={-1} />
                        </span>
                      </>
                    )}
                    {showNotes && <div className="w-16 flex-shrink-0">{'\u200B'}</div>}
                  </div>
                )}
                <span className="ml-auto text-[10px] font-semibold flex-shrink-0 min-w-12 text-right">{'\u200B'}</span>
              </div>
              )
            })}
          </div>
          <div
            ref={rowContainerRef}
            className="divide-y divide-border border rounded-md overflow-hidden"
            style={maxAttrWidth > 0 && fallbackLevel === 0 ? { '--max-attr-width': `${maxAttrWidth}px` } as React.CSSProperties : undefined}
          >
            {visibleMatched.map(({ weapon, isSelected }) => (
              <WeaponRow
                key={weapon.id}
                weapon={weapon}
                isSelected={isSelected}
                inRange={effectiveS1.includes(weapon.primaryStat)}
                selectedLabel={t('essence.weaponSelected')}
                notAvailableLabel={t('essence.weaponNotAvailable')}
                weaponOwnershipLabel={t('essence.weaponOwnershipLabel')}
                essenceOwnershipLabel={t('essence.essenceOwnershipLabel')}
                showOwnership={showOwnership}
                weaponOwned={weaponOwnership[weapon.id] === true}
                essenceOwned={essenceStatus[weapon.id] === true}
                note={showNotes ? weaponNotes[weapon.id] : undefined}
                onToggleWeaponOwned={() =>
                  setWeaponOwnership(
                    weapon.id,
                    !weaponOwnership[weapon.id],
                  )
                }
                onToggleEssenceOwned={() =>
                  setEssenceStatus(weapon.id, !essenceStatus[weapon.id])
                }
                onNoteChange={
                  showNotes
                    ? (value) => setWeaponNote(weapon.id, value)
                    : undefined
                }
                fallbackLevel={fallbackLevel}
              />
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleToggleExpand}
        aria-expanded={isExpanded}
        className="mt-3 h-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            'size-3 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
        {isExpanded ? t('essence.collapse') : t('essence.expand')}
      </Button>
    </div>
  )
})
