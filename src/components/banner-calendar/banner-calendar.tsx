'use client'

import { useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useBannerStore } from '@/stores/useBannerStore'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { TimelineControls } from './timeline-controls'
import { TimelineChart } from './timeline-chart'
import { PoolInfoStrip } from './pool-info-strip'
import { RerunWaitSection } from './rerun-wait-section'

export function BannerCalendar() {
  const t = useTranslations()
  const locale = useLocale()
  const { timelineData, needsFit, refresh, fitToViewport } = useBannerStore()
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const makeT = useCallback(
    () => (key: string, params?: Record<string, number | string>) =>
      t(key as Parameters<typeof t>[0], params as Parameters<typeof t>[1]),
    [t],
  )

  const doRefresh = useCallback(() => {
    refresh(makeT(), locale)
  }, [refresh, makeT, locale])

  const measureTimelineWidth = useCallback((): number => {
    if (typeof window === 'undefined') return 800
    const el = document.querySelector<HTMLElement>('[data-timeline-right]')
    return el?.getBoundingClientRect().width ?? window.innerWidth - 208
  }, [])

  const doFit = useCallback(() => {
    fitToViewport(measureTimelineWidth(), makeT(), locale)
  }, [fitToViewport, measureTimelineWidth, makeT, locale])

  // Auto-fit on first render
  useLayoutEffect(() => {
    if (needsFit) {
      requestAnimationFrame(doFit)
    }
  }, [needsFit, doFit])

  // Re-fit on sort mode change
  useEffect(() => {
    if (!needsFit) doRefresh()
  }, [doRefresh, needsFit])

  // Auto-refresh at next window boundary
  useEffect(() => {
    if (!timelineData) return
    const nowMs = Date.now()
    let nextBoundary = Infinity
    for (const ch of timelineData.charRows) {
      for (const bar of ch.bars) {
        if (bar.startMs > nowMs && bar.startMs < nextBoundary) nextBoundary = bar.startMs
        if (bar.endMs > nowMs && bar.endMs < nextBoundary) nextBoundary = bar.endMs
      }
    }
    if (!Number.isFinite(nextBoundary)) return
    const delay = Math.max(1000, nextBoundary - nowMs + 500)
    const timer = setTimeout(doRefresh, delay)
    return () => clearTimeout(timer)
  }, [timelineData, doRefresh])

  // Refresh on visibility change
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') doRefresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onVisibility)
    }
  }, [doRefresh])

  // Re-fit on window resize (debounced)
  useEffect(() => {
    const onResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = setTimeout(doFit, 200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
    }
  }, [doFit])

  const hasData = timelineData && timelineData.charRows.length > 0

  return (
    <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden">
      {/* Top bar: title + controls inline */}
      <div className="flex items-center gap-2 px-4 py-2 shadow-[var(--shadow-border-b)] shrink-0">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight shrink-0">
          {t('nav.bannerCalendar')}
        </h1>
        {hasData && (
          <div className="ml-2">
            <TimelineControls t={t} onRefresh={doRefresh} onFit={doFit} />
          </div>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground flex-wrap shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500/80" />
            {t('bannerCalendar.statusActive')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border-2 border-dashed border-amber-400/70" />
            {t('bannerCalendar.statusUpcoming')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-400/60" />
            {t('bannerCalendar.statusInPool')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            {t('bannerCalendar.statusPast')}
          </span>
        </div>
      )}

      {/* Main timeline - fills available space, vertical scroll on overflow */}
      <div className="px-4 pt-2 pb-0 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {hasData ? (
          <TimelineChart data={timelineData} t={t} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('bannerCalendar.noData')}
          </div>
        )}
      </div>

      {/* Pool info + days-since-last-banner stats — side by side so the timeline keeps its room */}
      <div className="shrink-0 grid md:grid-cols-2 gap-4 px-4 pb-4 pt-3">
        <PoolInfoStrip />
        <RerunWaitSection />
      </div>

    </div>
  )
}
