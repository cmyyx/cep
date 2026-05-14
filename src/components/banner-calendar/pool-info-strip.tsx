'use client'

import { useState, useRef, useMemo } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import bannerVisuals from '@/data/banner-visuals.json'
import type { BannerVisual } from '@/types/banner'

export function PoolInfoStrip() {
  const t = useTranslations()
  const [selectedVisual, setSelectedVisual] = useState<BannerVisual | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Sort by version descending
  const visuals = useMemo(() => {
    return [...bannerVisuals].sort((a, b) => {
      const vA = a.version.split('.').map(Number)
      const vB = b.version.split('.').map(Number)
      for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
        const numA = vA[i] ?? 0
        const numB = vB[i] ?? 0
        if (numA !== numB) return numB - numA
      }
      return 0
    })
  }, [])

  // Don't render if no data
  if (visuals.length === 0) return null

  const formatDate = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <>
      <div className="shrink-0 px-4 pb-4 pt-3">
        <div className="rounded-lg shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
            <span className="size-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              {t('bannerCalendar.poolInfo')}
            </span>
            <span className="text-xs text-muted-foreground/60 ml-auto">
              {t('bannerCalendar.poolInfoSubtitle')}
            </span>
          </div>

          {/* Horizontal scroll strip */}
          <div
            ref={scrollRef}
            className="flex gap-3 px-3 py-3 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
          >
            {visuals.map((visual) => (
              <button
                key={visual.id}
                onClick={() => setSelectedVisual(visual)}
                className={cn(
                  'relative flex-shrink-0 w-[280px] h-[160px] md:w-[320px] md:h-[180px] rounded-lg overflow-hidden',
                  'shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] cursor-pointer',
                  'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0px_2px_8px_rgba(0,0,0,0.12)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              >
                {/* Background image */}
                <Image
                  src={visual.imageUrl}
                  alt={visual.title}
                  fill
                  className="object-cover"
                  unoptimized
                  loading="lazy"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {visual.title}
                  </h3>
                  {visual.subtitle && (
                    <p className="text-xs text-white/80 mt-0.5 truncate">
                      {visual.subtitle}
                    </p>
                  )}
                  <p className="text-[10px] text-white/60 mt-1">
                    {formatDate(visual.periodStart)} - {formatDate(visual.periodEnd)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedVisual} onOpenChange={(open) => !open && setSelectedVisual(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-y-auto">
          {selectedVisual && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  {selectedVisual.title}
                </DialogTitle>
                {selectedVisual.subtitle && (
                  <DialogDescription className="text-sm text-muted-foreground">
                    {selectedVisual.subtitle}
                  </DialogDescription>
                )}
              </DialogHeader>

              {/* Banner image - 16:9 aspect ratio */}
              <div className="relative w-full aspect-video rounded-lg overflow-hidden my-4">
                <Image
                  src={selectedVisual.imageUrl}
                  alt={selectedVisual.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span className="font-medium">{t('bannerCalendar.poolDuration')}:</span>
                <span>
                  {formatDate(selectedVisual.periodStart)} - {formatDate(selectedVisual.periodEnd)}
                </span>
              </div>

              {/* Description */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {selectedVisual.description.split('\n').map((line, i) => (
                  <p key={i} className={line.trim() === '' ? 'h-2' : ''}>
                    {line}
                  </p>
                ))}
              </div>

              {/* Official link button */}
              {selectedVisual.officialUrl && (
                <div className="mt-4 flex justify-end">
                  <a
                    href={selectedVisual.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: 'default' })}
                  >
                    {t('bannerCalendar.viewDetails')}
                  </a>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
