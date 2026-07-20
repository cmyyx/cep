'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useAppInitStore } from '@/stores/useAppInitStore'
import { cn } from '@/lib/utils'
import { GuardFeedback } from '@/components/shared/guard-layout'
import { FullScreenStatus } from '@/components/shared/full-screen-status'

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
    <FullScreenStatus
      data-app-init="true"
      data-testid="app-init-overlay"
      heading={t('home.title')}
      animateIcon
      indicator={(
        <div className="h-1 w-[280px] overflow-hidden rounded-full bg-muted">
          <div className="h-full animate-[shimmer-slide_2s_linear_infinite]">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-develop-blue/35 to-transparent" />
          </div>
        </div>
      )}
      footer={<GuardFeedback title={t('feedback.title')} links={feedbackLinks} />}
      className={cn(
        'transition-opacity duration-400 ease-out',
        exitPhase === 'exiting' && 'pointer-events-none opacity-0',
      )}
      aria-hidden={exitPhase === 'exiting'}
    />
  )
}
