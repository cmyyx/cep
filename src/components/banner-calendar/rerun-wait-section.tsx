'use client'

import { useCallback, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'
import { useBannerStore, type RerunWaitOrder } from '@/stores/useBannerStore'
import { Button } from '@/components/ui/button'
import type { RerunWaitStat } from '@/types/banner'
import { cn } from '@/lib/utils'

/**
 * 1.15 keeps roughly 13% of the plot width free, so the day label always
 * fits after the longest bar without clipping the row.
 */
const PLOT_SCALE = 1.15

/**
 * The hover card never wraps, so its box is stable: the widest localized
 * content measured 193x84px. Clamping with these constants instead of reading
 * offsetWidth keeps a layout pass off every pointer move.
 */
const TIP_W = 260
const TIP_H = 90

/** Pointer-to-card offset, and the margin kept from the viewport edges. */
const TIP_GAP_X = 14
const TIP_GAP_Y = 48
const TIP_EDGE = 4

/**
 * Name colors for the three longest waits (gold / silver / bronze). Every
 * entry carries its own dark shade: the light ones stay readable on the
 * near-white canvas, the dark ones on the #0a0a0a canvas.
 */
const RANK_TEXT_CLASS: Record<number, string> = {
  1: 'text-amber-700 dark:text-amber-400',
  2: 'text-zinc-600 dark:text-zinc-300',
  3: 'text-orange-800 dark:text-orange-400',
}

/** Same three ranks as a tinted badge next to the name. */
const RANK_BADGE_CLASS: Record<number, string> = {
  1: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400',
  2: 'bg-zinc-500/15 text-zinc-600 dark:bg-zinc-300/15 dark:text-zinc-300',
  3: 'bg-orange-500/15 text-orange-800 dark:bg-orange-400/15 dark:text-orange-400',
}

/** Rank 4 and below still carries its badge, in the plain muted surface. */
const PLAIN_BADGE_CLASS = 'bg-muted text-muted-foreground'

const ORDER_ICONS: Record<RerunWaitOrder, typeof ArrowUpNarrowWide> = {
  asc: ArrowUpNarrowWide,
  desc: ArrowDownNarrowWide,
}

const ORDER_LABELS: Record<RerunWaitOrder, string> = {
  asc: 'bannerCalendar.rerunWaitSortAsc',
  desc: 'bannerCalendar.rerunWaitSortDesc',
}

export function RerunWaitSection() {
  const t = useTranslations()
  const locale = useLocale()
  const stats = useBannerStore((s) => s.timelineData?.rerunWaitStats)
  const order = useBannerStore((s) => s.rerunWaitOrder)
  const toggleOrder = useBannerStore((s) => s.toggleRerunWaitOrder)

  // Hover card — position and text are written straight to the DOM, so
  // following the pointer costs zero React re-renders (same approach as the
  // timeline chart tooltip above).
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipNameRef = useRef<HTMLDivElement>(null)
  const tooltipDaysRef = useRef<HTMLDivElement>(null)
  const tooltipEndedRef = useRef<HTMLDivElement>(null)
  const tooltipVersionRef = useRef<HTMLDivElement>(null)
  const hoveredKeyRef = useRef('')

  const hideTooltip = useCallback(() => {
    hoveredKeyRef.current = ''
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
  }, [])

  const handleRowMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, stat: RerunWaitStat) => {
      const tip = tooltipRef.current
      if (!tip) return

      const left = Math.max(
        Math.min(e.clientX + TIP_GAP_X, window.innerWidth - TIP_W - TIP_EDGE),
        TIP_EDGE,
      )
      const top = Math.min(
        Math.max(e.clientY - TIP_GAP_Y, TIP_EDGE),
        window.innerHeight - TIP_H - TIP_EDGE,
      )
      tip.style.left = `${left}px`
      tip.style.top = `${top}px`
      tip.style.display = 'block'

      // Cached on everything the card renders, not just the character name: a
      // store refresh or a locale switch can change the days, the ended date or
      // the wording under a pointer that never left its row.
      const key = `${stat.name}|${stat.days}|${stat.lastEndLabel}|${stat.lastVersion}|${locale}`
      if (hoveredKeyRef.current === key) return
      hoveredKeyRef.current = key
      if (tooltipNameRef.current) tooltipNameRef.current.textContent = stat.name
      if (tooltipDaysRef.current) {
        tooltipDaysRef.current.textContent = t('bannerCalendar.rerunWaitTooltipDays', { days: stat.days })
      }
      if (tooltipEndedRef.current) {
        tooltipEndedRef.current.textContent = t('bannerCalendar.rerunWaitTooltipEnded', { date: stat.lastEndLabel })
      }
      if (tooltipVersionRef.current) {
        tooltipVersionRef.current.textContent = stat.lastVersion
        tooltipVersionRef.current.style.display = stat.lastVersion ? '' : 'none'
      }
    },
    [locale, t],
  )

  if (!stats || stats.length === 0) return null

  const maxDays = Math.max(...stats.map((s) => s.days), 1)
  const plotMax = maxDays * PLOT_SCALE

  // Every character is ranked by wait length, longest first (TOP1..TOP N), so
  // the badge column is identical on every row and no row is left with a gap.
  const ranked = [...stats].sort((a, b) => b.days - a.days || a.name.localeCompare(b.name))
  const rankByName = new Map<string, number>(ranked.map((s, i): [string, number] => [s.name, i + 1]))

  // Store order (ascending, shortest wait first) or the ranked order reversed,
  // so the descending view reads TOP1 first.
  const rows = order === 'desc' ? ranked : stats
  const OrderIcon = ORDER_ICONS[order]

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
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={toggleOrder}
          className="gap-1 px-1.5 shrink-0"
          title={t('bannerCalendar.rerunWaitSortToggle')}
          aria-label={t('bannerCalendar.rerunWaitSortToggle')}
        >
          <OrderIcon className="size-3" />
          <span className="text-[10px] text-muted-foreground">
            {t(ORDER_LABELS[order])}
          </span>
        </Button>
      </div>

      {/* Bar rows spread over the full panel height (both grid columns stretch to the same height) */}
      <div
        data-slot="rerun-wait-list"
        className="flex min-h-0 flex-1 flex-col justify-between gap-2 px-3 py-3 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
        onMouseLeave={hideTooltip}
      >
        {rows.map((s) => {
          // rankByName is built from these very stats, so every row has one.
          const rank = rankByName.get(s.name)!
          return (
            <div
              key={s.name}
              className="flex items-center gap-2"
              onMouseMove={(e) => handleRowMove(e, s)}
              // Rows sit 8px apart (more when justify-between spreads them) and
              // the list also pads them, so the list-level mouseleave alone
              // would leave this card floating over a row nobody is on.
              onMouseLeave={hideTooltip}
            >
              <span
                data-rank={rank}
                className={cn(
                  'w-20 lg:w-24 shrink-0 truncate text-right text-sm',
                  rank <= 3 && 'font-semibold',
                  rank <= 3 && RANK_TEXT_CLASS[rank],
                )}
              >
                {s.name}
              </span>
              {/* Fixed-width badge slot: the badge is vertically centered with
                  the name, and its width never shifts a bar's starting edge. */}
              <span className="flex w-11 shrink-0 items-center">
                <span
                  className={cn(
                    'inline-flex items-center rounded-sm px-1 py-0.5 text-[10px] font-semibold leading-none',
                    rank <= 3 ? RANK_BADGE_CLASS[rank] : PLAIN_BADGE_CLASS,
                  )}
                >
                  {t('bannerCalendar.rerunWaitRankBadge', { rank })}
                </span>
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {/* --foreground/85 is near-black on the light canvas but would be
                    near-white on the dark one, so the dark shade is dialed down. */}
                <div
                  className="h-5 shrink-0 rounded-sm bg-foreground/85 dark:bg-foreground/25"
                  style={{ width: `${(s.days / plotMax) * 100}%` }}
                />
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {s.days}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hover card — one shadow utility only, same reasoning as the chart tooltip. */}
      <div
        ref={tooltipRef}
        data-slot="rerun-wait-tooltip"
        className="fixed z-50 pointer-events-none rounded-md bg-popover px-3 py-2 text-popover-foreground shadow-[var(--shadow-card)]"
        style={{ display: 'none' }}
      >
        <div ref={tooltipNameRef} className="text-sm font-medium" />
        <div ref={tooltipDaysRef} className="text-xs text-muted-foreground" />
        <div ref={tooltipEndedRef} className="text-xs text-muted-foreground" />
        <div ref={tooltipVersionRef} className="text-xs text-muted-foreground" />
      </div>
    </div>
  )
}
