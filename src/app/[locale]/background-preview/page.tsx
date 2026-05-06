'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, Eye, ExternalLink } from 'lucide-react'
import { useSettingsStore } from '@/stores/useSettingsStore'

export default function BackgroundPreviewPage() {
  const t = useTranslations()
  const { backgroundUrl } = useSettingsStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(backgroundUrl)

  const refreshImage = useCallback(() => {
    setIsLoading(true)
    const timestamp = Date.now()
    const separator = backgroundUrl.includes('?') ? '&' : '?'
    setCurrentUrl(`${backgroundUrl}${separator}t=${timestamp}`)
  }, [backgroundUrl])

  const handleViewClick = useCallback(() => {
    setIsFullscreen(true)
    if (!currentUrl || currentUrl === backgroundUrl) {
      refreshImage()
    }
  }, [currentUrl, backgroundUrl, refreshImage])

  const handleExitFullscreen = useCallback(() => {
    setIsFullscreen(false)
  }, [])

  const handleDownload = useCallback(() => {
    if (!currentUrl) return
    window.open(currentUrl, '_blank')
  }, [currentUrl])

  const handleImageLoad = () => {
    setIsLoading(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute inset-0">
          <img
            src={currentUrl}
            alt="Background Preview"
            className="w-full h-full object-cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="absolute top-4 right-4">
          <Button variant="secondary" size="sm" onClick={handleExitFullscreen}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            下载
          </Button>
          <Button variant="secondary" size="sm" onClick={refreshImage} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            立即刷新
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('nav.backgroundPreview')}
        </h1>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">
            点击下方按钮查看随机图片
          </p>
          <div className="flex gap-2">
            <Button onClick={handleViewClick} disabled={isLoading}>
              <Eye className="h-4 w-4 mr-2" />
              点击查看
            </Button>
            <a
              href="https://pan.quark.cn/s/27540d6f3706#/list/share"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted hover:text-foreground h-8 px-2.5 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              下载所有图片
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
