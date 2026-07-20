'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Info, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { bannerEntries } from '@/data/banner'
import type { BannerEntry } from '@/data/banner'

const CARD_CLOSE_DURATION = 150 // ms — must match `duration-150` in animation classes

export function PoolInfoStrip() {
  const t = useTranslations()
  const locale = useLocale()
  const [selectedVisual, setSelectedVisual] = useState<BannerEntry | null>(null)
  const [cardState, setCardState] = useState<'closed' | 'open' | 'closing'>('closed')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== undefined) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = undefined
      }
    }
  }, [])

  // Sort by version descending
  const visuals = useMemo(() => {
    return [...bannerEntries].sort((a, b) => {
      const vA = a.version.split('.').map(v => parseInt(v, 10) || 0)
      const vB = b.version.split('.').map(v => parseInt(v, 10) || 0)
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

  const isCardVisible = cardState !== 'closed'
  const openCard = () => {
    if (closeTimerRef.current !== undefined) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
    setCardState('open')
  }
  const closeCard = () => {
    setCardState('closing')
    closeTimerRef.current = setTimeout(() => {
      setCardState('closed')
      closeTimerRef.current = undefined
    }, CARD_CLOSE_DURATION)
  }

  const formatDate = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleDateString(locale, {
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
          <div className="flex gap-3 px-3 py-3 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
            {visuals.map((visual) => (
              <Button
                key={visual.id}
                type="button"
                variant="ghost"
                onClick={() => setSelectedVisual(visual)}
                className={cn(
                  'relative flex-shrink-0 w-[280px] h-[160px] md:w-[320px] md:h-[180px] rounded-lg overflow-hidden',
                  'shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08)] cursor-pointer p-0',
                  'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0px_2px_8px_rgba(0,0,0,0.12)] hover:bg-transparent',
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
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedVisual} onOpenChange={(open) => {
        if (!open) { setSelectedVisual(null); setCardState('closed') }
      }}>
        <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden" showCloseButton={false}>
          <DialogClose className="absolute top-3 left-3 z-40 flex items-center justify-center size-8 rounded-full text-white/90 hover:text-white bg-black/30 hover:bg-black/50 transition-colors ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="size-4" />
            <span className="sr-only">{t('common.close')}</span>
          </DialogClose>
          <DialogTitle className="sr-only">{selectedVisual?.title ?? t('bannerCalendar.poolInfo')}</DialogTitle>
          {selectedVisual && (
            <div className="relative aspect-video w-full overflow-hidden rounded-[inherit]">
              {/* Banner image */}
              <Image
                src={selectedVisual.imageUrl}
                alt={selectedVisual.title}
                fill
                className="object-cover"
                unoptimized
              />

              {/* Hint text — visible when card is open or closing */}
              {isCardVisible && (
                <div
                  className={cn(
                    'absolute top-3 left-1/2 -translate-x-1/2 z-30',
                    'text-[11px] text-white/60 tracking-wide whitespace-nowrap',
                    'pointer-events-none select-none',
                    cardState === 'open'
                      ? 'animate-in fade-in duration-200'
                      : 'animate-out fade-out duration-150'
                  )}
                >
                  {t('bannerCalendar.clickToClose')}
                </div>
              )}

              {/* Info button — only when card is closed */}
              {cardState === 'closed' && (
                <div className="absolute top-3 right-3 z-20">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('bannerCalendar.poolInfo')}
                    onClick={openCard}
                    className={cn(
                      'rounded-full text-white/90 hover:text-white',
                      'bg-black/30 hover:bg-black/50'
                    )}
                  >
                    <Info className="size-4" />
                  </Button>
                </div>
              )}

              {/* Click backdrop — closes card on image area click */}
              {isCardVisible && (
                <div
                  className="absolute inset-0 z-10 cursor-pointer"
                  onClick={closeCard}
                />
              )}

              {/* Floating info card */}
              {isCardVisible && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'absolute inset-x-3 bottom-3 z-20',
                    'flex flex-col',
                    'rounded-xl bg-background/80 backdrop-blur-2xl',
                    'shadow-[0px_4px_24px_rgba(0,0,0,0.12)]',
                    'overflow-hidden',
                    cardState === 'open'
                      ? 'animate-in fade-in slide-in-from-bottom-2 duration-200'
                      : 'animate-out fade-out slide-out-to-bottom-2 duration-150'
                  )}
                >
                  {/* Header */}
                  <div className="px-4 pt-3 pb-1">
                    <div className="flex flex-col gap-2 px-0 py-0">
                      <h3 className="text-sm font-semibold leading-tight">
                        {selectedVisual.title}
                      </h3>
                      {selectedVisual.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedVisual.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-4 pb-3 pt-1 overflow-y-auto max-h-48">
                    {/* Duration */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="font-medium">{t('bannerCalendar.poolDuration')}:</span>
                      <span>
                        {formatDate(selectedVisual.periodStart)} - {formatDate(selectedVisual.periodEnd)}
                      </span>
                    </div>

                    {/* Description — compact, skip blank lines */}
                    <div className="text-xs leading-relaxed text-foreground whitespace-normal break-words">
                      {selectedVisual.description.split('\n').filter((l) => l.trim()).map((line, i) => (
                        <p key={i} className="my-0.5">{line}</p>
                      ))}
                    </div>

                    {/* Official link button */}
                    {selectedVisual.officialUrl && (
                      <div className="mt-2 flex justify-end">
                        <a
                          href={selectedVisual.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: 'link', size: 'sm' }), 'h-auto px-0 text-xs')}
                        >
                          {t('bannerCalendar.viewDetails')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
