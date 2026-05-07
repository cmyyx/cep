'use client'

import type { TimelineTooltip as TooltipData } from '@/types/banner'

interface TimelineTooltipProps {
  data: TooltipData
  t: (key: string, params?: Record<string, number | string>) => string
}

export function TimelineTooltip({ data, t }: TimelineTooltipProps) {
  return (
    <div
      className="fixed z-50 pointer-events-none rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md"
      style={{ left: data.x + 14, top: data.y - 52 }}
    >
      <div className="text-sm font-medium">{data.charLabel || data.charName}</div>
      <div className="text-xs text-muted-foreground">
        {data.statusText} · {data.fullLabel}
      </div>
      {data.versionLabel && (
        <div className="text-xs text-muted-foreground">{data.versionLabel}</div>
      )}
      <div className="text-xs text-muted-foreground">
        {t('bannerCalendar.durationDays', { days: Number(data.durationDays) })}
      </div>
    </div>
  )
}
