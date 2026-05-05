'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    backgroundUrl,
    theme,
    toggleBackground,
    toggleBlur,
    setBackgroundUrl,
    restoreDefaultBg,
    setTheme,
  } = useSettingsStore()

  const [apiUrl, setApiUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [showFlashbangWarning, setShowFlashbangWarning] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setBackgroundUrl(url)
  }

  const handleApiApply = () => {
    if (apiUrl.trim()) {
      setBackgroundUrl(apiUrl.trim())
      setApiUrl('')
    }
  }

  const handleThemeChange = (newTheme: string) => {
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
    auto: '自动（跟随系统）',
    light: '浅色',
    dark: '深色',
    flashbang: '闪光弹 (HDR)',
  }

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <SidebarTrigger />
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
      </div>

      <div className="flex flex-col gap-4 max-w-lg">
        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">主题</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">主题模式</Label>
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
          </CardContent>
        </Card>

        {/* Background */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">背景</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">启用背景</Label>
              <Switch checked={backgroundEnabled} onCheckedChange={toggleBackground} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">背景模糊</Label>
              <Switch checked={backgroundBlur} onCheckedChange={toggleBlur} disabled={!backgroundEnabled} />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm">自定义背景 API URL</Label>
              <div className="flex gap-2">
                <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://..." className="text-sm h-9" />
                <Button size="sm" variant="outline" onClick={handleApiApply} className="text-sm h-9">应用</Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm">上传背景图片</Label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="text-xs" />
            </div>
            <Button variant="outline" size="sm" onClick={restoreDefaultBg} className="w-fit">
              恢复默认背景
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Flashbang warning dialog */}
      {showFlashbangWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Card className="max-w-sm mx-4">
            <CardHeader>
              <CardTitle className="text-base text-destructive">警告</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                闪光弹模式仅供整活，会强制启用 HDR 色彩空间并使用极端高亮配色。
                谨慎开启，可能会导致视觉不适或其他严重后果。
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowFlashbangWarning(false)}>取消</Button>
                <Button variant="destructive" size="sm" onClick={confirmFlashbang}>确认开启</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
