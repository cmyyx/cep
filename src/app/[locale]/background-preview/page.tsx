'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Images } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { WeeklyWallpaperSection } from '@/components/background-preview/daily-wallpaper-section'
import { FullscreenImageDialogContent } from '@/components/shared/fullscreen-image-dialog'
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


  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border-b)]">
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
            <span>{t('backgroundPreview.websiteBackgroundCollection')}</span>
          </TooltipTrigger>
          <TooltipContent>{t('backgroundPreview.websiteBackgroundCollectionHint')}</TooltipContent>
        </Tooltip>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <button
          type="button"
          className="absolute inset-0 size-full cursor-pointer select-none rounded-none bg-transparent text-sm text-muted-foreground transition-colors hover:bg-transparent hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
          onClick={() => setIsFullscreen(true)}
          aria-label={t('backgroundPreview.clickHint')}
        >
          <span className="pointer-events-none absolute top-3 right-0 left-0 px-4 text-center leading-5 sm:top-4">
            {t('backgroundPreview.clickHint')}
          </span>
        </button>
        <div className="absolute right-3 bottom-0 z-10 max-h-[calc(100%-2.75rem)] w-[min(23rem,calc(100%-1.5rem))] overflow-y-auto overscroll-contain sm:right-4 sm:bottom-0 sm:max-h-[calc(100%-3.25rem)]">
          <WeeklyWallpaperSection apiUrl={FEATURES.wallpaperApiUrl} />
        </div>
      </main>

      <footer className="shrink-0 px-4 py-2 shadow-[var(--shadow-border-t)]">
        <p className="text-center text-[11px] text-muted-foreground/60">{t('backgroundPreview.disclaimer')}</p>
      </footer>
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <FullscreenImageDialogContent
          src={backgroundUrl}
          alt=""
          title={t('nav.backgroundPreview')}
          closeLabel={t('backgroundPreview.close')}
          imageClassName="object-cover"
          priority
        />
      </Dialog>
    </div>
  )
}
