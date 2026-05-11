'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Upload } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/stores/useSettingsStore'

export default function SettingsPage() {
  const t = useTranslations()

  const {
    backgroundEnabled,
    backgroundBlur,
    backgroundUrl,
    theme,
    toggleBackground,
    toggleBlur,
    setBackgroundUrl,
    restoreDefaultBg,
    setTheme,
  } = useSettingsStore()

  const [apiUrl, setApiUrl] = useState('')
  const [showFlashbangWarning, setShowFlashbangWarning] = useState(false)

  // Revoke blob URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (backgroundUrl.startsWith('blob:')) {
        URL.revokeObjectURL(backgroundUrl)
      }
    }
  }, [backgroundUrl])

  const handleApiApply = () => {
    if (apiUrl.trim()) {
      setBackgroundUrl(apiUrl.trim())
      setApiUrl('')
    }
  }

  const handleThemeChange = (newTheme: string | null) => {
    if (!newTheme) return
    if (newTheme === 'flashbang') {
      setShowFlashbangWarning(true)
      return
    }
    setTheme(newTheme as 'auto' | 'light' | 'dark' | 'flashbang')
  }

  const confirmFlashbang = () => {
    setTheme('flashbang')
    setShowFlashbangWarning(false)
  }

  const THEME_LABELS: Record<string, string> = {
    auto: t('settings.themeAuto'),
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
    flashbang: t('settings.themeFlashbang'),
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">{t('nav.settings')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-6 max-w-lg">
        {/* 主题设置组 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">{t('settings.theme')}</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm">{t('settings.themeMode')}</Label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-40">
                  <SelectValue>
                    {(v: string) => THEME_LABELS[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(THEME_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* 分隔线 */}
        <div className="h-px bg-border" />

        {/* 背景设置组 */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">{t('settings.background')}</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm">{t('settings.enableBackground')}</Label>
              <Switch checked={backgroundEnabled} onCheckedChange={toggleBackground} />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm">{t('settings.backgroundBlur')}</Label>
              <Switch checked={backgroundBlur} onCheckedChange={toggleBlur} disabled={!backgroundEnabled} />
            </div>
            <div className="flex flex-col gap-2 py-2">
              <Label className="text-sm">{t('settings.apiUrl')}</Label>
              <div className="flex gap-2">
                <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://..." className="text-sm h-9" />
                <Button size="sm" variant="outline" onClick={handleApiApply} className="text-sm h-9">{t('settings.apply')}</Button>
              </div>
            </div>
            {/* TODO: Re-enable when blob URL + IndexedDB storage is implemented.
                Currently blob URLs leak memory and are not persisted across sessions.
                See: useSettingsStore.setBackgroundUrl, handleFileChange for revoke logic. */}
            <div className="flex flex-col gap-2 py-2">
              <Label className="text-sm">{t('settings.uploadImage')}</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled
                >
                  <Upload className="size-3 mr-1" />
                  {t('settings.selectFile')}
                </Button>
                <span className="text-[10px] text-muted-foreground">{t('settings.backgroundUploadNotReady')}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={restoreDefaultBg} className="w-fit">
              {t('settings.restoreDefault')}
            </Button>
          </div>
        </section>
      </div>

      {/* Flashbang warning dialog */}
      <Dialog open={showFlashbangWarning} onOpenChange={setShowFlashbangWarning}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('settings.flashbangWarning')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('settings.flashbangDesc')}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowFlashbangWarning(false)}>{t('settings.cancel')}</Button>
            <Button variant="destructive" size="sm" onClick={confirmFlashbang}>{t('settings.confirmFlashbang')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
