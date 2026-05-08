'use client'

import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { DungeonPlan, WeaponMatch } from '@/lib/planner/essence-solver'
import { useMatrixStore, getPlanKey } from '@/stores/useMatrixStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

interface RowProps extends ThumbProps {
  selectedLabel: string
  notAvailableLabel: string
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
  const ref = useRef<HTMLDivElement>(null)

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
    return () =>
      scrollables.forEach((el) =>
        el.removeEventListener('scroll', handler),
      )
  }, [open, setOpen])

  return ref
}

const WeaponThumbnail = memo(function WeaponThumbnail({
  weapon,
  isSelected,
  inRange,
}: ThumbProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useCloseOnScroll(open, setOpen)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <div
            ref={triggerRef}
            className={cn(
              'relative w-12 h-12 rounded-md border overflow-hidden cursor-default',
              'bg-[url(/images/item-frame-bg.png)] bg-cover bg-center',
              inRange && isSelected && 'border-amber-400/50',
              inRange && !isSelected && 'border-border',
              !inRange && isSelected && 'border-amber-400/20 opacity-40',
              !inRange && !isSelected && 'border-border/50 opacity-30',
            )}
          />
        }
      >
        <Image
          src={`/images/weapons/${weapon.imageId || 'wpn_sword_0001'}.avif`}
          alt={weapon.name}
          fill
          className="object-cover z-10"
          unoptimized
        />
        <Image
          src={`/images/item-band-${weapon.rarity}.png`}
          alt=""
          width={200}
          height={10}
          className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
          unoptimized
        />
        {inRange && isSelected && (
          <div className="absolute top-0 right-0 size-3 bg-amber-400 rounded-bl-sm flex items-center justify-center z-30">
            <span className="text-[6px] text-black font-bold">✓</span>
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-xs text-foreground bg-popover/95"
      >
        <p className={cn('font-semibold', !inRange && 'line-through')}>
          {weapon.name}
        </p>
        <p className="text-muted-foreground/80">
          {weapon.primaryStat} | {weapon.elementalDamage} |{' '}
          {weapon.specialAbility}
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
}: RowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm',
        !inRange && !isSelected && 'opacity-30',
        !inRange && isSelected && 'opacity-40 bg-amber-500/3',
        inRange && isSelected && 'bg-amber-500/5',
        inRange && !isSelected && 'hover:bg-muted/30',
      )}
    >
      <div className="relative size-10 rounded border border-border bg-muted/30 flex-shrink-0 overflow-hidden bg-[url(/images/item-frame-bg.png)] bg-cover bg-center">
        <Image
          src={`/images/weapons/${weapon.imageId || 'wpn_sword_0001'}.avif`}
          alt={weapon.name}
          fill
          className="object-cover z-10"
          unoptimized
        />
        <Image
          src={`/images/item-band-${weapon.rarity}.png`}
          alt=""
          width={200}
          height={8}
          className="absolute -inset-x-px bottom-0 z-20 w-[calc(100%+2px)] max-w-none object-cover object-bottom pointer-events-none"
          unoptimized
        />
      </div>
      <span
        className={cn(
          'font-medium min-w-0 truncate w-28 flex-shrink-0',
          !inRange && 'line-through',
          inRange && isSelected && 'text-amber-400',
        )}
      >
        {weapon.name}
      </span>
      <span className="text-xs text-muted-foreground min-w-0 truncate">
        {weapon.primaryStat} | {weapon.elementalDamage} |{' '}
        {weapon.specialAbility}
      </span>
      {inRange && isSelected && (
        <span className="ml-auto text-[10px] text-amber-400 font-bold flex-shrink-0">
          {selectedLabel}
        </span>
      )}
      {!inRange && isSelected && (
        <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
          {notAvailableLabel}
        </span>
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

  const handleToggleExpand = useCallback(() => {
    toggleDungeonExpand(plan.dungeon.id)
  }, [toggleDungeonExpand, plan.dungeon.id])

  const effectiveS1 = useMemo(() => {
    if (!plan.needsS1Choice) return plan.s1Candidates
    return dungeonS1Selections[planKey] || plan.selectedS1
  }, [plan, planKey, dungeonS1Selections])

  const selectedVisible = plan.matchedWeapons.filter(
    (m) => m.isSelected && effectiveS1.includes(m.weapon.primaryStat)
  ).length

  const lockLabel = plan.lockType === 's2' ? t('essence.lockS2') : t('essence.lockS3')

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{plan.dungeon.name}</h3>
          {plan.selectedCount > 0 && (
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                selectedVisible === plan.selectedCount
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600'
              )}
            >
              {selectedVisible}/{plan.selectedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {t('essence.selected')}:{' '}
            <strong className="text-foreground">{selectedVisible}</strong>
          </span>
          <span>
            {t('essence.total')}:{' '}
            <strong className="text-foreground">{plan.totalCount}</strong>{' '}
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
              <strong className="text-foreground">{s}</strong>
              {i < effectiveS1.length - 1 ? ', ' : ''}
            </span>
          ))}
          ]
        </span>
        <span className="text-muted-foreground/50">|</span>
        <span>
          {lockLabel}:{' '}
          <strong className="text-foreground">{plan.lockValue}</strong>
        </span>
      </div>

      {/* S1 Picker */}
      {plan.needsS1Choice && (
        <div className="mb-3 p-3 rounded-md border border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-amber-600 mb-2">
            {t('essence.s1PickerHint', { candidates: plan.s1Candidates.length })}
          </p>
          <div className="flex flex-wrap gap-3">
            {[...plan.s1Candidates]
              .sort(
                (a, b) =>
                  (plan.s1CandidateCounts[b] || 0) -
                  (plan.s1CandidateCounts[a] || 0)
              )
              .map((s1) => {
                const wCount = plan.s1CandidateCounts[s1] || 0
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
                    {s1} ({t('essence.weaponCount', { count: wCount })})
                  </label>
                )
              })}
          </div>
        </div>
      )}

      {/* Thumbnails (collapsed) or Rows (expanded) */}
      {!isExpanded ? (
        <div key="collapsed" className="flex flex-wrap gap-1.5">
          {plan.matchedWeapons.map(({ weapon, isSelected }) => (
            <WeaponThumbnail
              key={weapon.id}
              weapon={weapon}
              isSelected={isSelected}
              inRange={effectiveS1.includes(weapon.primaryStat)}
            />
          ))}
        </div>
      ) : (
        <div key="expanded" className="animate-in slide-in-from-top-2 duration-200 [animation-fill-mode:backwards]">
          <div className="divide-y divide-border border rounded-md overflow-hidden">
            {plan.matchedWeapons.map(({ weapon, isSelected }) => (
              <WeaponRow
                key={weapon.id}
                weapon={weapon}
                isSelected={isSelected}
                inRange={effectiveS1.includes(weapon.primaryStat)}
                selectedLabel={t('essence.weaponSelected')}
                notAvailableLabel={t('essence.weaponNotAvailable')}
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
