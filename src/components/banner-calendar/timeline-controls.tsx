'use client'

import { useBannerStore, type SortMode } from '@/stores/useBannerStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Maximize2, Axis3d, ArrowUpAZ, ArrowDownZA, LayoutList } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimelineControlsProps {
  t: (key: string) => string
  onRefresh: () => void
  onFit: () => void
}

const SORT_ICONS: Record<SortMode, typeof LayoutList> = {
  default: LayoutList,
  asc: ArrowUpAZ,
  desc: ArrowDownZA,
}

const SORT_LABELS: Record<SortMode, string> = {
  default: 'bannerCalendar.sortDefault',
  asc: 'bannerCalendar.sortAsc',
  desc: 'bannerCalendar.sortDesc',
}

const SORT_ORDER: SortMode[] = ['default', 'asc', 'desc']

export function TimelineControls({ t, onRefresh, onFit }: TimelineControlsProps) {
  const { zoom, fullOverview, showPreviewAxis, sortMode, setZoom, togglePreviewAxis, setSortMode } =
    useBannerStore()

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0])
    onRefresh()
  }

  const cycleSortMode = () => {
    const idx = SORT_ORDER.indexOf(sortMode)
    const next = SORT_ORDER[(idx + 1) % SORT_ORDER.length]
    setSortMode(next)
    onRefresh()
  }

  const SortIcon = SORT_ICONS[sortMode]

  return (
    <div className="flex items-center gap-3 shrink-0">
      {/* Zoom slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {t('bannerCalendar.zoom')}
        </span>
        <Slider
          value={[zoom]}
          onValueChange={handleZoomChange}
          min={1.5}
          max={15}
          step={0.5}
          className="w-24"
        />
        <span className="text-xs text-muted-foreground w-8 tabular-nums">
          {zoom.toFixed(1)}x
        </span>
      </div>

      {/* Full overview toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onFit}
        className={cn('h-7 px-2', fullOverview && 'bg-accent')}
        title={t('bannerCalendar.overviewTitle')}
      >
        <Maximize2 className="size-3.5" />
      </Button>

      {/* Preview axis toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePreviewAxis}
        className={cn('h-7 px-2', showPreviewAxis && 'bg-accent')}
        title={t('bannerCalendar.previewAxisTitle')}
      >
        <Axis3d className="size-3.5" />
      </Button>

      {/* Sort mode cycle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={cycleSortMode}
        className="h-7 px-2 gap-1"
        title={t(SORT_LABELS[sortMode])}
      >
        <SortIcon className="size-3.5" />
        <span className="text-[10px] text-muted-foreground">{t(SORT_LABELS[sortMode])}</span>
      </Button>
    </div>
  )
}
