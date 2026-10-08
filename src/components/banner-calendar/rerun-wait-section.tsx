'use client'

import { useTranslations } from 'next-intl'
import { useBannerStore } from '@/stores/useBannerStore'

/**
 * 1.15 keeps roughly 13% of the plot width free, so the day label always
 * fits after the longest bar without clipping the row.
 */
const PLOT_SCALE = 1.15

export function RerunWaitSection() {
  const t = useTranslations()
  const stats = useBannerStore((s) => s.timelineData?.rerunWaitStats)

  if (!stats || stats.length === 0) return null

  const maxDays = Math.max(...stats.map((s) => s.days), 1)
  const plotMax = maxDays * PLOT_SCALE

  return (
    <div className="flex flex-col rounded-lg shadow-[var(--shadow-border)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 shadow-[var(--shadow-border-b)]">
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          {t('bannerCalendar.rerunWaitTitle')}
        </span>
        <span className="ml-auto truncate text-xs text-muted-foreground/60">
          {t('bannerCalendar.rerunWaitSubtitle')}
        </span>
      </div>

      {/* Bar rows spread over the full panel height (both grid columns stretch to the same height) */}
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 px-3 py-3 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
        {stats.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="w-16 lg:w-20 shrink-0 truncate text-xs text-muted-foreground">
              {s.name}
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <div
                className="h-5 shrink-0 rounded-sm bg-foreground/85"
                style={{ width: `${(s.days / plotMax) * 100}%` }}
              />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {s.days}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
