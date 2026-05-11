'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'

export function SettingsDialog() {
  const t = useTranslations()

  const {
    backgroundEnabled,
    backgroundBlur,
    backgroundUrl,
    toggleBackground,
    toggleBlur,
    setBackgroundUrl,
  } = useSettingsStore()

  const [apiUrl, setApiUrl] = useState(backgroundUrl)
  const [open, setOpen] = useState(false)

  const handleApiApply = () => {
    if (apiUrl.trim()) {
      setBackgroundUrl(apiUrl.trim())
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8">
            <Settings className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('settings.background')}</Label>
            <Switch checked={backgroundEnabled} onCheckedChange={toggleBackground} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('settings.backgroundBlur')}</Label>
            <Switch
              checked={backgroundBlur}
              onCheckedChange={toggleBlur}
              disabled={!backgroundEnabled}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm">{t('settings.apiUrl')}</Label>
            <div className="flex gap-2">
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://..."
                className="text-xs h-8"
              />
              <Button size="sm" variant="outline" onClick={handleApiApply} className="text-xs h-8">
                {t('settings.apply')}
              </Button>
            </div>
          </div>
          {/* TODO: Re-enable when blob URL + IndexedDB storage is implemented. */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">{t('settings.uploadImage')}</Label>
            <span className="text-[10px] text-muted-foreground">{t('settings.backgroundUploadNotReady')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
