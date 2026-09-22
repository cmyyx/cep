'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useAppInitStore } from '@/stores/useAppInitStore'
import { cn } from '@/lib/utils'
import { FEEDBACK_CHANNELS, GuardFeedback } from '@/components/shared/guard-layout'
import { FullScreenStatus } from '@/components/shared/full-screen-status'

/**
 * Full-viewport loading curtain.
 *
 * Renders from the very first SSG HTML frame so the pre-hydration window is not
 * a flash of unanchored content.
 *
 * Reveal policy: hydration ONLY. The curtain used to wait for the `version` and
 * `announcements` tasks — `/version.json` plus the announcement index and every
 * announcement markdown file — and each of those paths additionally slept for a
 * hard-coded `MIN_LOADING_DISPLAY_MS`. Measured on Fast 3G the curtain lifted
 * 300 ms after hydration, so the network gate bought nothing but a slower
 * reveal. Announcements now resolve into their own panel skeleton instead.
 *
 * Repeat visits skip the curtain entirely: `hasCompleted` is persisted to
 * sessionStorage, and the inline <head> bootstrap sets `<html data-cep-init-done>`
 * so CSS hides `[data-app-init]` from the first paint (see globals.css) rather
 * than painting it and removing it after hydration.
 *
 * When JavaScript is disabled, the overlay is hidden by a .no-js CSS rule (see
 * globals.css) so crawlers and no-JS users see the static SSG content.
 */
/**
 * Whether this commit should render the curtain.
 *
 * The export is static, so the shipped HTML always carries the curtain and the
 * first client render has to match it: applying the persisted `hasCompleted`
 * flag on that first render would remove the node during hydration and make
 * React patch the DOM. Only from the commit that has seen hydration may the
 * flag hide the curtain. CSS already hides it on repeat visits in the meantime
 * (`html[data-cep-init-done]`, see app-init-done-script.ts), so nothing flashes.
 *
 * Exported because React's mismatch handling cannot be asserted reliably in
 * jsdom — this is the contract, pinned by app-init-overlay.test.tsx.
 */
export function curtainVisible(hydrated: boolean, hasCompleted: boolean): boolean {
  return !hydrated || !hasCompleted
}

export function AppInitOverlay() {
  const hasCompleted = useAppInitStore((s) => s.hasCompleted)
  const markReady = useAppInitStore((s) => s.markReady)
  const markCompleted = useAppInitStore((s) => s.markCompleted)
  const ready = useAppInitStore((s) => s.phase === 'ready')

  // See curtainVisible() above for why the persisted flag is applied one commit
  // after the first render instead of during it.
  const [hydrated, setHydrated] = useState(false)
  const [exitPhase, setExitPhase] = useState<'none' | 'exiting'>('none')
  const t = useTranslations()

  // Hydration sentinel for the inline JS-resource guard: set as soon as this
  // component mounts, which proves React hydrated. If a critical chunk fails,
  // this never runs and the guard shows its fallback instead of leaving the
  // overlay stuck forever. Must stay ahead of any early return.
  useEffect(() => {
    document.documentElement.setAttribute('data-cep-hydrated', '1')
    // Mount-only flag whose false value IS the point (it keeps the first render
    // aligned with the shipped HTML), so it cannot be derived during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, [])

  // Reveal on the next frame after hydration — no network task gates this.
  useEffect(() => {
    if (!hydrated || hasCompleted) return
    const raf = requestAnimationFrame(() => markReady())
    return () => cancelAnimationFrame(raf)
  }, [hydrated, hasCompleted, markReady])

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
    { href: FEEDBACK_CHANNELS.github.href, label: t('feedback.github') },
    { href: FEEDBACK_CHANNELS.forum.href, label: t('feedback.forum') },
    { href: FEEDBACK_CHANNELS.qqGroup.href, label: t('feedback.qqGroup') },
  ], [t])

  if (!curtainVisible(hydrated, hasCompleted)) return null

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
