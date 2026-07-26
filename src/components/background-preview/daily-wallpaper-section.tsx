'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, ExternalLink, History, ImageOff, Info, RefreshCw } from 'lucide-react'
import { WallpaperMediaFrame } from '@/components/background-preview/wallpaper-media-frame'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addWallpaperLocale,
  DailyWallpaperError,
  DEFAULT_WALLPAPER_ASPECT_RATIO,
  fetchDailyWallpapers,
  formatWallpaperDate,
  resolveWallpaperAspectRatio,
} from '@/lib/daily-wallpapers'
import type { DailyWallpaperFeed } from '@/types/daily-wallpaper'

interface DailyWallpaperSectionProps {
  apiUrl: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; feed: DailyWallpaperFeed }
  | { status: 'error'; code: DailyWallpaperError['code'] }

export function DailyWallpaperSection({ apiUrl }: DailyWallpaperSectionProps) {
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
    void fetchDailyWallpapers(apiUrl, controller.signal)
      .then((feed) => {
        if (!active) return
        setState({ status: 'ready', feed })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (!active) return
        const code = error instanceof DailyWallpaperError ? error.code : 'requestFailed'
        setState({ status: 'error', code })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [apiUrl, retryKey])

  const markImageFailed = (contentDate: string) => {
    setFailedImages((previous) => new Set(previous).add(contentDate))
  }

  const rememberAspectRatio = (contentDate: string, width: number, height: number) => {
    const nextRatio = resolveWallpaperAspectRatio(width, height)
    setAspectRatios((previous) => {
      if (previous[contentDate] === nextRatio) return previous
      return { ...previous, [contentDate]: nextRatio }
    })
  }

  if (state.status === 'loading') {
    return (
      <Card aria-label={t('dailyTitle')} size="sm" className="gap-0! overflow-hidden bg-background py-0! shadow-[var(--shadow-card)]">
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
      <Card aria-label={t('dailyTitle')} size="sm" className="gap-0! bg-background py-0! shadow-[var(--shadow-card)]">
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

  const { current, history } = state.feed
  if (!current) {
    return (
      <Card aria-label={t('dailyTitle')} size="sm" className="gap-0! bg-background py-0! shadow-[var(--shadow-card)]">
        <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 py-3 text-center">
          <ImageOff className="size-5 text-muted-foreground" />
          <p className="font-medium">{t('dailyEmpty')}</p>
          <p className="text-xs text-muted-foreground">{t('dailyEmptyHint')}</p>
        </CardContent>
      </Card>
    )
  }

  const currentDate = formatWallpaperDate(current.contentDate, locale)
  const currentImageFailed = !current.imageUrl || failedImages.has(current.contentDate)

  return (
    <>
      <Card aria-labelledby="daily-wallpaper-title" size="sm" className="gap-0! overflow-hidden bg-background py-0! shadow-[var(--shadow-card)]">
        <WallpaperMediaFrame
          tone="hero"
          aspectRatio={aspectRatios[current.contentDate] ?? DEFAULT_WALLPAPER_ASPECT_RATIO}
          failed={currentImageFailed}
          imageUrl={current.imageUrl}
          sizes="(max-width: 640px) calc(100vw - 1.5rem), 23rem"
          loading="eager"
          unavailableLabel={t('imageUnavailable')}
          badge={<Badge>{t('dailyUpdatedBadge')}</Badge>}
          onLoad={(event) => {
            const image = event.currentTarget
            rememberAspectRatio(current.contentDate, image.naturalWidth, image.naturalHeight)
          }}
          onError={() => markImageFailed(current.contentDate)}
        />
        <CardContent className="space-y-3 py-3">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 id="daily-wallpaper-title" className="text-lg font-semibold tracking-[-0.48px]">{t('dailyTitle')}</h2>
              <time className="shrink-0 font-mono text-[11px] text-muted-foreground" dateTime={current.contentDate}>{currentDate}</time>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {current.isToday ? t('dailyShortDescription') : t('fallbackDescription', { date: currentDate })}
            </p>
          </div>
          {current.actionUrl ? (
            <Button
              nativeButton={false}
              className="w-full"
              render={<a href={addWallpaperLocale(current.actionUrl, locale)} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink data-icon="inline-start" />
              {t('getTodayWallpaper')}
            </Button>
          ) : (
            <Button className="w-full" disabled>{t('linkUnavailable')}</Button>
          )}
          <p className="text-[11px] leading-4 text-muted-foreground">{t('promotionDisclosure')}</p>
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
              const dateLabel = formatWallpaperDate(item.contentDate, locale)
              const imageFailed = !item.imageUrl || failedImages.has(item.contentDate)
              return (
                <Card key={item.contentDate} size="sm" className="gap-0! overflow-hidden py-0!">
                  <WallpaperMediaFrame
                    tone="history"
                    aspectRatio={aspectRatios[item.contentDate] ?? DEFAULT_WALLPAPER_ASPECT_RATIO}
                    failed={imageFailed}
                    imageUrl={item.imageUrl}
                    sizes="(max-width: 640px) 100vw, 24rem"
                    unavailableLabel={t('imageUnavailable')}
                    onLoad={(event) => {
                      const image = event.currentTarget
                      rememberAspectRatio(item.contentDate, image.naturalWidth, image.naturalHeight)
                    }}
                    onError={() => markImageFailed(item.contentDate)}
                  />
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <time className="font-mono text-xs text-muted-foreground" dateTime={item.contentDate}>{dateLabel}</time>
                    {item.actionUrl ? (
                      <Button
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                        render={<a href={addWallpaperLocale(item.actionUrl, locale)} target="_blank" rel="noopener noreferrer" />}
                      >
                        {t('getWallpaper')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>{t('linkUnavailableShort')}</Button>
                    )}
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
export default DailyWallpaperSection
