'use client'

import { useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { useBannerStore } from '@/stores/useBannerStore'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { TimelineControls } from './timeline-controls'
import { TimelineChart } from './timeline-chart'

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
  const hasStandard = timelineData && timelineData.standardChars.length > 0

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top bar: title + controls inline */}
      <div className="flex items-center gap-2 px-4 py-2 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)] shrink-0">
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

      {/* Main timeline - fills available space */}
      <div className="flex-1 min-h-0 px-4 pt-2 pb-0">
        {hasData ? (
          <TimelineChart data={timelineData} t={t} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('bannerCalendar.noData')}
          </div>
        )}
      </div>

      {/* Standard characters table - follows page margins */}
      {hasStandard && (
        <div className="shrink-0 px-4 pb-4 pt-3">
          <div className="rounded-lg shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
              <span className="size-2 rounded-full bg-secondary" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('bannerCalendar.badgeStandard')}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 px-3 py-3">
              {timelineData!.standardChars.map((ch) => (
                <div key={ch.name} className="flex items-center gap-2">
                  <div className="relative size-7 rounded-full overflow-hidden bg-muted shrink-0">
                    <Image
                      src={ch.avatarSrc}
                      alt={ch.name}
                      fill
                      className="object-cover"
                      unoptimized
                      loading="lazy"
                    />
                  </div>
                  <span className="text-sm">{ch.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
