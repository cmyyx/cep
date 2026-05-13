'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { ExternalLink, X } from 'lucide-react'
import { useSettingsStore } from '@/stores/useSettingsStore'

const QUARK_PAN_URL = 'https://pan.quark.cn/s/27540d6f3706#/list/share'

export default function BackgroundPreviewPage() {
  const t = useTranslations()
  const { backgroundUrl } = useSettingsStore()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleEnterFullscreen = useCallback(() => {
    setIsFullscreen(true)
  }, [])

  const handleExitFullscreen = useCallback(() => {
    setIsFullscreen(false)
  }, [])

  // Lock body scroll when fullscreen, auto-focus overlay for keyboard support
  useEffect(() => {
    if (!isFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    overlayRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isFullscreen])

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExitFullscreen()
      }
    },
    [handleExitFullscreen]
  )

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleEnterFullscreen()
      }
    },
    [handleEnterFullscreen]
  )

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black outline-none"
        tabIndex={-1}
        onClick={handleExitFullscreen}
        onKeyDown={handleOverlayKeyDown}
        role="dialog"
        aria-label={t('nav.backgroundPreview')}
      >
        <Image
          src={backgroundUrl}
          alt=""
          fill
          className="object-cover"
          unoptimized
          priority
        />
        <div
          className="absolute top-4 right-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="secondary"
            size="icon"
            onClick={handleExitFullscreen}
            aria-label={t('backgroundPreview.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Normal view
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('nav.backgroundPreview')}
        </h1>
        <a
          href={QUARK_PAN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-background text-sm font-medium h-8 px-2.5 transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="h-4 w-4" />
          {t('backgroundPreview.downloadAll')}
        </a>
      </div>

      {/* Main content — click anywhere to enter fullscreen */}
      <div
        ref={contentRef}
        className="flex flex-1 items-center justify-center p-4 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={handleEnterFullscreen}
        onKeyDown={handleContentKeyDown}
        tabIndex={0}
        role="button"
        aria-label={t('backgroundPreview.clickHint')}
      >
        <p className="text-muted-foreground text-sm">
          {t('backgroundPreview.clickHint')}
        </p>
      </div>
    </div>
  )
}
