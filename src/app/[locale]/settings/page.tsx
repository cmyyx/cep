'use client'

import { useState, useRef } from 'react'
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
} from '@/components/ui/select'
import { useSettingsStore } from '@/stores/useSettingsStore'

export default function SettingsPage() {
  const t = useTranslations()

  const {
    backgroundEnabled,
    backgroundBlur,
    theme,
    toggleBackground,
    toggleBlur,
    setBackgroundUrl,
    restoreDefaultBg,
    setTheme,
  } = useSettingsStore()

  const [apiUrl, setApiUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [showFlashbangWarning, setShowFlashbangWarning] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const url = URL.createObjectURL(file)
    setBackgroundUrl(url)
  }

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
                  <span>{THEME_LABELS[theme]}</span>
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
            <div className="flex flex-col gap-2 py-2">
              <Label className="text-sm">{t('settings.uploadImage')}</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-3 mr-1" />
                  {t('settings.selectFile')}
                </Button>
                {fileName && (
                  <span className="text-xs text-muted-foreground truncate max-w-48">{fileName}</span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={restoreDefaultBg} className="w-fit">
              {t('settings.restoreDefault')}
            </Button>
          </div>
        </section>
      </div>

      {/* Flashbang warning dialog */}
      {showFlashbangWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-w-sm mx-4 bg-background rounded-lg p-6 shadow-lg">
            <h3 className="text-base font-semibold text-destructive mb-4">{t('settings.flashbangWarning')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('settings.flashbangDesc')}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowFlashbangWarning(false)}>{t('settings.cancel')}</Button>
              <Button variant="destructive" size="sm" onClick={confirmFlashbang}>{t('settings.confirmFlashbang')}</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
