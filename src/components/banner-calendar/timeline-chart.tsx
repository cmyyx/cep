'use client'

import { useRef, useCallback } from 'react'
import Image from 'next/image'
import { useBannerStore } from '@/stores/useBannerStore'
import type { TimelineData } from '@/types/banner'
import { cn } from '@/lib/utils'

function InfoIcon({ note }: { note: string }) {
  return (
    <span className="relative inline-flex items-center ml-1" data-info-note={note}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-sky-400 cursor-help"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    </span>
  )
}

const HEADER_H = 32
const ROW_H = 52
const BAR_TOP = 8
const BAR_H = 28

interface TimelineChartProps {
  data: TimelineData
  t: (key: string, params?: Record<string, number | string>) => string
}

export function TimelineChart({ data, t }: TimelineChartProps) {
  const { showPreviewAxis } = useBannerStore()
  const previewRef = useRef<HTMLDivElement>(null)
  const previewDateRef = useRef<HTMLSpanElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const hoveredBarKeyRef = useRef<string>('')

  // Tooltip refs — all position/content updates via DOM, zero React re-renders
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipNameRef = useRef<HTMLDivElement>(null)
  const tooltipInfoRef = useRef<HTMLDivElement>(null)
  const tooltipVersionRef = useRef<HTMLDivElement>(null)
  const tooltipDurationRef = useRef<HTMLDivElement>(null)

  // Info note tooltip refs
  const infoTooltipRef = useRef<HTMLDivElement>(null)
  const infoTooltipTextRef = useRef<HTMLDivElement>(null)

  const rowsHeight = data.charRows.length * ROW_H

  const hideTooltip = useCallback(() => {
    hoveredBarKeyRef.current = ''
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
    if (infoTooltipRef.current) infoTooltipRef.current.style.display = 'none'
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Close bar tooltip before re-evaluating
      if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      if (infoTooltipRef.current) infoTooltipRef.current.style.display = 'none'

      const rightPanel = rightPanelRef.current
      if (!rightPanel) return

      // Info icon tooltip (left panel)
      const infoTarget = (e.target as HTMLElement).closest('[data-info-note]')
      if (infoTarget && infoTooltipRef.current && infoTooltipTextRef.current) {
        const note = (infoTarget as HTMLElement).getAttribute('data-info-note') || ''
        infoTooltipTextRef.current.textContent = note
        const tx = Math.min(e.clientX + 14, window.innerWidth - 320)
        const ty = Math.max(e.clientY - 52, 4)
        infoTooltipRef.current.style.left = `${tx}px`
        infoTooltipRef.current.style.top = `${ty}px`
        infoTooltipRef.current.style.display = 'block'
        return
      }

      const rightRect = rightPanel.getBoundingClientRect()
      const xInRight = e.clientX - rightRect.left + rightPanel.scrollLeft
      const isOverRight = e.clientX >= rightRect.left && xInRight >= 0

      // Preview axis
      if (showPreviewAxis && isOverRight && previewRef.current) {
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

      // Tooltip — pure math, zero DOM queries
      if (!isOverRight) { hideTooltip(); return }

      const yInRows = e.clientY - rightRect.top - HEADER_H
      if (yInRows < 0) { hideTooltip(); return }

      const rowIndex = Math.floor(yInRows / ROW_H)
      const yInRow = yInRows - rowIndex * ROW_H
      if (rowIndex >= data.charRows.length || yInRow < BAR_TOP || yInRow > BAR_TOP + BAR_H) {
        hideTooltip(); return
      }

      // Find bar by x position
      const row = data.charRows[rowIndex]
      let hit: (typeof row.bars)[number] | null = null
      for (const bar of row.bars) {
        if (xInRight >= bar.leftPx && xInRight <= bar.leftPx + bar.widthPx) {
          hit = bar
          break
        }
      }

      if (!hit) { hideTooltip(); return }

      // Show tooltip — clamp to viewport bounds
      if (tooltipRef.current) {
        const tx = Math.min(e.clientX + 14, window.innerWidth - 320)
        const ty = Math.max(e.clientY - 52, 4)
        tooltipRef.current.style.left = `${tx}px`
        tooltipRef.current.style.top = `${ty}px`
        tooltipRef.current.style.display = 'block'
      }

      const barKey = `${hit.charName}-${hit.fullLabel}`
      if (barKey !== hoveredBarKeyRef.current) {
        hoveredBarKeyRef.current = barKey
        if (tooltipNameRef.current) tooltipNameRef.current.textContent = hit.charLabel || hit.charName
        if (tooltipInfoRef.current) tooltipInfoRef.current.textContent = `${hit.statusText} · ${hit.fullLabel}`
        if (tooltipVersionRef.current) {
          tooltipVersionRef.current.textContent = hit.versionLabel
          tooltipVersionRef.current.style.display = hit.versionLabel ? '' : 'none'
        }
        if (tooltipDurationRef.current) {
          tooltipDurationRef.current.textContent = t('bannerCalendar.durationDays', { days: hit.durationDays })
        }
      }
    },
    [showPreviewAxis, data.pxPerDay, data.rStartMs, data.charRows, t, hideTooltip],
  )

  const handleMouseLeave = useCallback(() => {
    if (previewRef.current) previewRef.current.style.display = 'none'
    hideTooltip()
  }, [hideTooltip])

  return (
    <div
      className="flex flex-1 overflow-hidden rounded-lg shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left: Character column */}
      <div className="w-52 shrink-0 shadow-[1px_0px_0px_0px_rgba(0,0,0,0.08)] bg-muted/30">
        <div className="h-8 flex items-center px-3 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)] text-xs font-medium text-muted-foreground">
          {t('bannerCalendar.characterHeader')}
        </div>
        {data.charRows.map((ch) => (
          <div
            key={ch.name}
            className="h-[52px] flex items-center gap-2 px-3 border-b border-border/50"
          >
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
            <span className="text-sm font-medium whitespace-nowrap">
              {ch.name}
              {ch.offRateNote && <InfoIcon note={ch.offRateNote} />}
            </span>
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
      <div ref={rightPanelRef} data-timeline-right className="flex-1 overflow-x-auto">
        <div style={{ width: data.canvasW }} className="relative">
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

          <div className="relative">
            {data.charRows.map((ch) => (
              <div key={ch.name} className="relative h-[52px] border-b border-border/50">
                {data.months.reduce<{ nodes: React.ReactNode[]; offset: number }>((acc, m) => {
                  acc.nodes.push(
                    <div
                      key={m.label}
                      className="absolute inset-y-0 border-r border-border/30"
                      style={{ left: acc.offset, width: m.wPx }}
                    />,
                  )
                  acc.offset += m.wPx
                  return acc
                }, { nodes: [], offset: 0 }).nodes}

                {ch.bars.map((bar) => (
                  <div
                    key={`${bar.startMs}-${bar.endMs}-${bar.versionLabel}`}
                    className={cn(
                      'absolute top-2 h-7 rounded-sm flex items-center justify-center text-[10px] font-medium cursor-default',
                      bar.cls === 'active' && 'bg-emerald-500/80 text-white',
                      bar.cls === 'past' && 'bg-muted-foreground/30 text-muted-foreground',
                      bar.cls === 'upcoming' && 'border-2 border-dashed border-amber-400/70 text-amber-400 bg-amber-400/10',
                      bar.cls === 'rerun' && 'border-2 border-dashed border-amber-400/70 text-amber-400 bg-amber-400/10',
                      bar.cls === 'inPool' && 'bg-sky-400/40 text-sky-800 dark:text-sky-200 border border-sky-400/50',
                    )}
                    style={{ left: bar.leftPx, width: bar.widthPx }}
                  >
                    {bar.dateLabel}
                  </div>
                ))}
              </div>
            ))}

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

      {/* Bar tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 pointer-events-none rounded-md shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] bg-popover px-3 py-2 text-popover-foreground shadow-md"
        style={{ display: 'none' }}
      >
        <div ref={tooltipNameRef} className="text-sm font-medium" />
        <div ref={tooltipInfoRef} className="text-xs text-muted-foreground" />
        <div ref={tooltipVersionRef} className="text-xs text-muted-foreground" />
        <div ref={tooltipDurationRef} className="text-xs text-muted-foreground" />
      </div>

      {/* Info note tooltip */}
      <div
        ref={infoTooltipRef}
        className="fixed z-50 pointer-events-none rounded-md shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] bg-popover px-3 py-2 text-popover-foreground shadow-md max-w-72"
        style={{ display: 'none' }}
      >
        <div ref={infoTooltipTextRef} className="text-xs text-muted-foreground" />
      </div>
    </div>
  )
}
