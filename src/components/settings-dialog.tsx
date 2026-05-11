'use client'

import { useState, useEffect } from 'react'
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
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">背景</Label>
            <Switch checked={backgroundEnabled} onCheckedChange={toggleBackground} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">背景模糊</Label>
            <Switch
              checked={backgroundBlur}
              onCheckedChange={toggleBlur}
              disabled={!backgroundEnabled}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-sm">自定义背景 API</Label>
            <div className="flex gap-2">
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://..."
                className="text-xs h-8"
              />
              <Button size="sm" variant="outline" onClick={handleApiApply} className="text-xs h-8">
                应用
              </Button>
            </div>
          </div>
          {/* TODO: Re-enable when blob URL + IndexedDB storage is implemented. */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">上传背景图片</Label>
            <span className="text-[10px] text-muted-foreground">图片上传开发中，暂不可用</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
