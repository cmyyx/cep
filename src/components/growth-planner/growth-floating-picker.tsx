'use client'

import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { GrowthEntityPicker } from '@/components/growth-planner/growth-entity-picker'

export function GrowthFloatingPicker() {
  const t = useTranslations('growthPlanner')
  const isMobile = useIsMobile()
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const expanded = hovered || pinned

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHovered(false)
        setPinned(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  if (isMobile) return null

  return (
    <div
      data-growth-floating-picker
      data-expanded={expanded}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        'fixed top-1/2 z-40 flex -translate-y-1/2 items-center overflow-visible opacity-95 [filter:drop-shadow(0_0_1px_rgba(0,0,0,0.16))_drop-shadow(0_2px_2px_rgba(0,0,0,0.06))] transition-[right,opacity] duration-300 ease-out hover:opacity-100',
        expanded ? 'right-0' : '-right-128',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        data-growth-picker-handle
        aria-label={t('pickerRail')}
        aria-expanded={expanded}
        aria-controls="growth-floating-picker-panel"
        onClick={() => setPinned((value) => !value)}
        className="relative z-10 h-auto min-h-16 w-10 shrink-0 flex-col gap-1 rounded-l-lg rounded-r-none bg-popover px-0 py-1.5 shadow-none"
      >
        <UserRound className="size-4" aria-hidden="true" />
        <span className="px-0.5 text-[11px] tracking-[0.18em] [writing-mode:vertical-rl]">
          {t('pickerRail')}
        </span>
      </Button>
      <div
        id="growth-floating-picker-panel"
        aria-hidden={!expanded}
        className={cn(
          'flex h-[min(72svh,40rem)] w-128 shrink-0 flex-col overflow-hidden rounded-xl bg-popover p-4 shadow-[var(--shadow-card)]',
          !expanded && 'pointer-events-none',
        )}
      >
        <GrowthEntityPicker />
      </div>
    </div>
  )
}
