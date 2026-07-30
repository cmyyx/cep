'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, ExternalLink, History, ImageOff, Info, RefreshCw } from 'lucide-react'
import { JustifiedWallpaperGallery } from '@/components/background-preview/justified-wallpaper-gallery'
import { WallpaperMediaFrame } from '@/components/background-preview/wallpaper-media-frame'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addWallpaperLocale,
  WeeklyWallpaperError,
  DEFAULT_WALLPAPER_ASPECT_RATIO,
  fetchWeeklyWallpapers,
  formatWallpaperDate,
  formatWallpaperDateRange,
  resolveWallpaperAspectRatio,
} from '@/lib/daily-wallpapers'
import type { WeeklyWallpaperFeed } from '@/types/daily-wallpaper'

interface WeeklyWallpaperSectionProps {
  apiUrl: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; feed: WeeklyWallpaperFeed }
  | { status: 'error'; code: WeeklyWallpaperError['code'] }

export function WeeklyWallpaperSection({ apiUrl }: WeeklyWallpaperSectionProps) {
  const t = useTranslations('backgroundPreview')
  const rootT = useTranslations()
  const locale = useLocale()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [retryKey, setRetryKey] = useState(0)
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set())
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

  const handleRetry = () => {
    setState({ status: 'loading' })
    setFailedImages(new Set())
    setAspectRatios({})
    setRetryKey((value) => value + 1)
  }

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void fetchWeeklyWallpapers(apiUrl, controller.signal)
      .then((feed) => {
        if (!active) return
        setState({ status: 'ready', feed })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (!active) return
        const code = error instanceof WeeklyWallpaperError ? error.code : 'requestFailed'
        setState({ status: 'error', code })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [apiUrl, retryKey])

  const markImageFailed = (id: string) => {
    setFailedImages((previous) => new Set(previous).add(id))
  }

  const rememberAspectRatio = (id: string, width: number, height: number) => {
    const nextRatio = resolveWallpaperAspectRatio(width, height)
    setAspectRatios((previous) => {
      if (previous[id] === nextRatio) return previous
      return { ...previous, [id]: nextRatio }
    })
  }

  if (state.status === 'loading') {
    return (
      <Card aria-label={t('weeklyTitle')} size="sm" className="gap-0! overflow-hidden bg-background py-0! shadow-[var(--shadow-card)]">
        <Skeleton
          className="w-full max-h-[min(42svh,16rem)] rounded-none sm:max-h-[min(48svh,28rem)]"
          style={{ aspectRatio: String(DEFAULT_WALLPAPER_ASPECT_RATIO) }}
        />
        <CardContent className="space-y-3 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (state.status === 'error') {
    return (
      <Card aria-label={t('weeklyTitle')} size="sm" className="gap-0! bg-background py-0! shadow-[var(--shadow-card)]">
        <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 py-3 text-center">
          <AlertCircle className="size-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{t(`dailyErrors.${state.code}`)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rootT('backgroundPreview.dailyErrors.hint')}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleRetry}>
            <RefreshCw data-icon="inline-start" />
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { weekItems, history, isActive, actionUrl, weekStart, displayUntil } = state.feed
  if (weekItems.length === 0) {
    return (
      <Card aria-label={t('weeklyTitle')} size="sm" className="gap-0! bg-background py-0! shadow-[var(--shadow-card)]">
        <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 py-3 text-center">
          <ImageOff className="size-5 text-muted-foreground" />
          <p className="font-medium">{t('weeklyEmpty')}</p>
          <p className="text-xs text-muted-foreground">{t('weeklyEmptyHint')}</p>
        </CardContent>
      </Card>
    )
  }

  const weekRangeLabel = formatWallpaperDateRange(weekStart, displayUntil, locale)

  return (
    <>
      <Card aria-labelledby="weekly-wallpaper-title" size="sm" className="gap-0! overflow-hidden bg-background py-0! shadow-[var(--shadow-card)]">
        <div className="relative">
          <JustifiedWallpaperGallery
            items={weekItems}
            aspectRatios={aspectRatios}
            failedImages={failedImages}
            sizes="(max-width: 640px) calc(100vw - 1.5rem), 23rem"
            onLoad={(id, event) => {
              const image = event.currentTarget
              rememberAspectRatio(id, image.naturalWidth, image.naturalHeight)
            }}
            onError={(id) => markImageFailed(id)}
          />
          <div className="absolute top-2 left-2">
            <Badge>{t('weeklyUpdatedBadge')}</Badge>
          </div>
        </div>
        <CardContent className="space-y-3 py-3">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 id="weekly-wallpaper-title" className="text-lg font-semibold tracking-[-0.48px]">{t('weeklyTitle')}</h2>
              <time className="shrink-0 font-mono text-[11px] text-muted-foreground" dateTime={weekStart}>{weekRangeLabel}</time>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isActive ? t('weeklyDescription') : t('weeklyFallbackDescription', { range: weekRangeLabel })}
            </p>
          </div>

          {actionUrl ? (
            <Button
              nativeButton={false}
              className="w-full"
              render={<a href={addWallpaperLocale(actionUrl, locale)} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink data-icon="inline-start" />
              {t('getWeeklyWallpaper')}
            </Button>
          ) : (
            <Button className="w-full" disabled>{t('linkUnavailable')}</Button>
          )}
          <p className="text-[11px] leading-4 text-muted-foreground">{t('promotionDisclosure')}</p>

          <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
            {t('weeklyChangeNotice')}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setHistoryOpen(true)} disabled={history.length === 0}>
              <History data-icon="inline-start" />
              {t('viewHistory')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSupportOpen(true)}>
              <Info data-icon="inline-start" />
              {t('supportDetails')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[min(80svh,48rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('historyTitle')}</DialogTitle>
            <DialogDescription>{t('historyDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {history.map((item) => {
              const dateLabel = formatWallpaperDate(item.id, locale)
              const imageFailed = !item.imageUrl || failedImages.has(item.id)
              return (
                <Card key={item.id} size="sm" className="gap-0! overflow-hidden py-0!">
                  <WallpaperMediaFrame
                    tone="history"
                    aspectRatio={aspectRatios[item.id] ?? DEFAULT_WALLPAPER_ASPECT_RATIO}
                    failed={imageFailed}
                    imageUrl={item.imageUrl}
                    sizes="(max-width: 640px) 100vw, 24rem"
                    unavailableLabel={t('imageUnavailable')}
                    onLoad={(event) => {
                      const image = event.currentTarget
                      rememberAspectRatio(item.id, image.naturalWidth, image.naturalHeight)
                    }}
                    onError={() => markImageFailed(item.id)}
                  />
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <time className="font-mono text-xs text-muted-foreground" dateTime={item.id}>{dateLabel}</time>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('supportDetailsTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('supportIntro')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>{t('supportIntro')}</p>
            <p>{t('supportSchedule')}</p>
            <p>{t('supportThanks')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default WeeklyWallpaperSection
