'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useAppInitStore } from '@/stores/useAppInitStore'
import { cn } from '@/lib/utils'
import { GuardFeedback } from '@/components/shared/guard-layout'

/**
 * Full-viewport loading overlay.
 *
 * Renders from the very first SSG HTML frame to prevent layout shifts
 * (announcement banner, etc.) from being visible before hydration completes.
 *
 * Instead of a fake percentage-based progress bar, shows an indeterminate
 * skeleton shimmer — a CSS-only animation that communicates "loading" without
 * lying about progress. Fades out when all registered init tasks complete.
 *
 * When JavaScript is disabled, the overlay is hidden by a .no-js CSS rule
 * (see globals.css) so crawlers and no-JS users see the static SSG content.
 */
export function AppInitOverlay() {
  const hasCompleted = useAppInitStore((s) => s.hasCompleted)
  const markReady = useAppInitStore((s) => s.markReady)
  const markCompleted = useAppInitStore((s) => s.markCompleted)
  const beginTracking = useAppInitStore((s) => s.beginTracking)
  const tasks = useAppInitStore((s) => s.tasks)
  const completedTasks = useAppInitStore((s) => s.completedTasks)

  const [exitPhase, setExitPhase] = useState<'none' | 'exiting'>('none')
  const t = useTranslations()

  // Kick off task registration after mount.
  // beginTracking() is idempotent — it checks hasCompleted internally.
  useEffect(() => {
    if (hasCompleted) return
    beginTracking()
  }, [hasCompleted, beginTracking])

  // When all registered tasks complete (or none were registered) → exit.
  const allTasksDone = tasks.size === 0 || [...tasks].every((t) => completedTasks.has(t))
  const ready = useAppInitStore((s) => s.phase === 'ready')
  const markReadyFromStore = useCallback(() => markReady(), [markReady])

  useEffect(() => {
    if (!allTasksDone || ready) return
    markReadyFromStore()
  }, [allTasksDone, ready, markReadyFromStore])

  // Ready → exit animation → permanently hide.
  useEffect(() => {
    if (!ready || hasCompleted) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExitPhase('exiting')
    const timer = setTimeout(() => markCompleted(), 450)
    return () => clearTimeout(timer)
  }, [ready, hasCompleted, markCompleted])

  // Built before early-return to satisfy Rules of Hooks.
  const feedbackLinks = useMemo(() => [
    { href: 'https://github.com/cmyyx/cep', label: t('feedback.github') },
    { href: 'https://end.302200.xyz', label: t('feedback.forum') },
    { href: 'https://qm.qq.com/q/Cjdo2aRikE', label: t('feedback.qqGroup') },
  ], [t])

  // Never show again after first completion.
  if (hasCompleted) return null

  return (
    <div
      data-app-init="true" data-testid="app-init-overlay"
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background',
        'transition-opacity duration-400 ease-out',
        exitPhase === 'exiting' && 'opacity-0 pointer-events-none',
      )}
      aria-hidden={exitPhase === 'exiting'}
    >
      {/* Engineering grid background */}
      <div className="absolute inset-0 pointer-events-none animate-[grid-drift_20s_linear_infinite] bg-engineering-grid" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-7 z-10">
        {/* Icon with breathing pulse */}
        <div className="animate-[icon-pulse_2s_ease-in-out_infinite] size-14 flex items-center justify-center">
          <div className="relative size-14">
            <Image
              src="/icon.svg"
              alt=""
              width={56}
              height={56}
              className="size-14"
              unoptimized
              priority
            />
            <div className="absolute inset-0 -z-10 rounded-full bg-develop-blue/10 blur-xl scale-125 animate-[icon-glow_2s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Brand */}
        <h1 className="text-[48px] font-semibold font-mono tracking-[-2.88px] text-foreground select-none animate-[glitch-converge_1.2s_cubic-bezier(0.16,1,0.3,1)_forwards]">
          CEP
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground tracking-[-0.32px] font-medium -mt-5 select-none">
          {t('home.title')}
        </p>

        {/* Indeterminate shimmer bar — smooth continuous gradient sweep.
            No percentages, no fake progress — a single clean animation
            that just says "loading". */}
        <div className="w-[280px] h-[4px] bg-muted rounded-full overflow-hidden">
          <div className="h-full animate-[shimmer-slide_2s_linear_infinite]">
            <div className="h-full w-[50%] rounded-full bg-gradient-to-r from-transparent via-develop-blue/35 to-transparent" />
          </div>
        </div>

        {/* Feedback channels */}
        <GuardFeedback title={t('feedback.title')} links={feedbackLinks} />
      </div>
    </div>
  )
}
