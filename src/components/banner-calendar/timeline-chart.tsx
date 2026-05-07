'use client'

import { useRef, useCallback } from 'react'
import Image from 'next/image'
import { useBannerStore } from '@/stores/useBannerStore'
import type { TimelineData, TimelineTooltip as TooltipData } from '@/types/banner'
import { cn } from '@/lib/utils'

interface TimelineChartProps {
  data: TimelineData
  t: (key: string, params?: Record<string, number | string>) => string
}

export function TimelineChart({ data, t }: TimelineChartProps) {
  const { showPreviewAxis, setTooltip } = useBannerStore()
  const previewRef = useRef<HTMLDivElement>(null)
  const previewDateRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const rowsHeight = data.charRows.length * 52

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rightPanel = containerRef.current?.querySelector<HTMLElement>('[data-timeline-right]')
      if (!rightPanel) return

      const rightRect = rightPanel.getBoundingClientRect()
      const xInRight = e.clientX - rightRect.left + rightPanel.scrollLeft
      const isOverRight = e.clientX >= rightRect.left

      // Preview axis
      if (showPreviewAxis && isOverRight && xInRight >= 0 && previewRef.current) {
        previewRef.current.style.left = `${xInRight}px`
        previewRef.current.style.display = 'block'
        if (previewDateRef.current) {
          const dayOffset = xInRight / data.pxPerDay
          const ms = data.rStartMs + dayOffset * 86400000
          previewDateRef.current.textContent = new Date(ms).toLocaleDateString()
        }
      } else if (previewRef.current) {
        previewRef.current.style.display = 'none'
      }

      // Tooltip
      const barEl = (e.target as HTMLElement).closest<HTMLElement>('[data-char-name]')
      if (barEl) {
        const tip: TooltipData = {
          charName: barEl.dataset.charName ?? '',
          charLabel: barEl.dataset.charLabel ?? '',
          fullLabel: barEl.dataset.fullLabel ?? '',
          statusText: barEl.dataset.statusText ?? '',
          durationDays: barEl.dataset.durationDays ?? '',
          versionLabel: barEl.dataset.versionLabel ?? '',
          x: e.clientX,
          y: e.clientY,
        }
        setTooltip(tip)
      } else {
        setTooltip(null)
      }
    },
    [showPreviewAxis, data.pxPerDay, data.rStartMs, setTooltip],
  )

  const handleMouseLeave = useCallback(() => {
    if (previewRef.current) previewRef.current.style.display = 'none'
    setTooltip(null)
  }, [setTooltip])

  return (
    <div
      ref={containerRef}
      className="flex flex-1 overflow-hidden border rounded-lg"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left: Character column */}
      <div className="w-52 shrink-0 border-r bg-muted/30">
        {/* Header */}
        <div className="h-8 flex items-center px-3 border-b text-xs font-medium text-muted-foreground">
          {t('bannerCalendar.characterHeader')}
        </div>
        {/* Rows */}
        {data.charRows.map((ch) => (
          <div
            key={ch.name}
            className="h-[52px] flex items-center gap-2 px-3 border-b border-border/50"
          >
            {/* Avatar */}
            <div className="relative size-8 rounded-full overflow-hidden bg-muted shrink-0">
              <Image
                src={ch.avatarSrc}
                alt={ch.name}
                fill
                className="object-cover"
                unoptimized
                loading="lazy"
              />
            </div>
            {/* Name - never truncate */}
            <span className="text-sm font-medium whitespace-nowrap">{ch.name}</span>
            {/* Status badge */}
            {ch.statusBadge && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium ml-auto',
                  ch.statusBadge.type === 'active' && 'bg-emerald-500/20 text-emerald-400',
                  ch.statusBadge.type === 'upcoming' && 'bg-amber-500/20 text-amber-400',
                  ch.statusBadge.type === 'inPool' && 'bg-sky-500/20 text-sky-400',
                  ch.statusBadge.type === 'out' && 'bg-muted text-muted-foreground',
                  ch.statusBadge.type === 'standard' && 'bg-secondary text-secondary-foreground',
                )}
              >
                {ch.statusBadge.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Right: Gantt chart */}
      <div data-timeline-right className="flex-1 overflow-x-auto">
        <div style={{ width: data.canvasW }} className="relative">
          {/* Month header */}
          <div className="h-8 flex border-b">
            {data.months.map((m) => (
              <div
                key={m.label}
                className="flex items-center px-2 text-xs text-muted-foreground border-r border-border/50 shrink-0"
                style={{ width: m.wPx }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="relative">
            {data.charRows.map((ch) => (
              <div key={ch.name} className="relative h-[52px] border-b border-border/50">
                {/* Month backgrounds */}
                {data.months.map((m) => (
                  <div
                    key={m.label}
                    className="absolute inset-y-0 border-r border-border/30"
                    style={{ width: m.wPx }}
                  />
                ))}

                {/* Window bars */}
                {ch.bars.map((bar) => (
                  <div
                    key={`${bar.startMs}-${bar.endMs}-${bar.versionLabel}`}
                    className={cn(
                      'absolute top-2 h-7 rounded-sm flex items-center justify-center text-[10px] font-medium transition-colors cursor-default',
                      bar.cls === 'active' && 'bg-emerald-500/80 text-white',
                      bar.cls === 'past' && 'bg-muted-foreground/30 text-muted-foreground',
                      bar.cls === 'upcoming' && 'border-2 border-dashed border-amber-400/70 text-amber-400 bg-amber-400/10',
                      bar.cls === 'rerun' && 'border-2 border-dashed border-amber-400/70 text-amber-400 bg-amber-400/10',
                      bar.cls === 'inPool' && 'bg-sky-400/40 text-sky-200 border border-sky-400/50',
                    )}
                    style={{ left: bar.leftPx, width: bar.widthPx }}
                    data-char-name={bar.charName}
                    data-char-label={bar.charLabel}
                    data-full-label={bar.fullLabel}
                    data-status-text={bar.statusText}
                    data-duration-days={bar.durationDays}
                    data-version-label={bar.versionLabel}
                  >
                    {bar.dateLabel}
                  </div>
                ))}
              </div>
            ))}

            {/* Today line */}
            {data.showToday && data.todayPx !== null && (
              <div
                className="absolute top-0 w-px bg-primary z-10"
                style={{ left: data.todayPx, height: rowsHeight }}
              >
                <span className="absolute -top-0 left-1 text-[10px] text-primary font-medium whitespace-nowrap">
                  {t('bannerCalendar.today')}
                </span>
              </div>
            )}

            {/* Preview axis (hidden by default) */}
            <div
              ref={previewRef}
              className="absolute top-0 w-px bg-foreground/30 z-10 hidden"
              style={{ height: rowsHeight }}
            >
              <span
                ref={previewDateRef}
                className="absolute -top-0 left-1 text-[10px] text-foreground/50 whitespace-nowrap"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
