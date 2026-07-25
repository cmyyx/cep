'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Images, X } from 'lucide-react'
import { DailyWallpaperSection } from '@/components/background-preview/daily-wallpaper-section'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FEATURES } from '@/lib/features'
import { useSettingsStore } from '@/stores/useSettingsStore'

const WEBSITE_BACKGROUND_COLLECTION_URL = 'https://pan.quark.cn/s/27540d6f3706#/list/share'

export default function BackgroundPreviewPage() {
  const t = useTranslations()
  const { backgroundUrl } = useSettingsStore()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleExitFullscreen = useCallback(() => setIsFullscreen(false), [])

  useEffect(() => {
    if (!isFullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    overlayRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  if (isFullscreen) {
    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black outline-none"
        tabIndex={-1}
        onClick={handleExitFullscreen}
        onKeyDown={(event) => {
          if (event.key === 'Escape') handleExitFullscreen()
        }}
        role="dialog"
        aria-label={t('nav.backgroundPreview')}
      >
        <Image src={backgroundUrl} alt="" fill className="object-cover" unoptimized priority />
        <div className="absolute top-4 right-4" onClick={(event) => event.stopPropagation()}>
          <Button variant="secondary" size="icon" onClick={handleExitFullscreen} aria-label={t('backgroundPreview.close')}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
        <SidebarTrigger />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{t('nav.backgroundPreview')}</h1>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                nativeButton={false}
                size="sm"
                variant="outline"
                aria-label={t('backgroundPreview.websiteBackgroundCollection')}
                render={
                  <a
                    href={WEBSITE_BACKGROUND_COLLECTION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              />
            }
          >
            <Images />
            <span className="hidden sm:inline">{t('backgroundPreview.websiteBackgroundCollection')}</span>
          </TooltipTrigger>
          <TooltipContent>{t('backgroundPreview.websiteBackgroundCollectionHint')}</TooltipContent>
        </Tooltip>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          className="absolute inset-0 size-full cursor-pointer select-none rounded-none text-sm text-muted-foreground hover:bg-transparent hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-inset"
          onClick={() => setIsFullscreen(true)}
          aria-label={t('backgroundPreview.clickHint')}
        >
          {t('backgroundPreview.clickHint')}
        </Button>
        <div className="absolute right-3 bottom-0 z-10 w-[min(23rem,calc(100%-1.5rem))] sm:right-4 sm:bottom-0">
          <DailyWallpaperSection apiUrl={FEATURES.wallpaperApiUrl} />
        </div>
      </main>

      <footer className="shrink-0 px-4 py-2 shadow-[0px_-1px_0px_0px_rgba(0,0,0,0.08)]">
        <p className="text-center text-[11px] text-muted-foreground/60">{t('backgroundPreview.disclaimer')}</p>
      </footer>
    </div>
  )
}
