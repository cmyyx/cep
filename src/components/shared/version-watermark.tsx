'use client'

import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useVersion } from '@/hooks/use-version'
import { formatTime } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export function VersionWatermark() {
  const t = useTranslations()
  const { info, localInfo } = useVersion()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [open, setOpen] = useState(false)

  const displayInfo = localInfo ?? info
  if (!displayInfo) return null

  const versionStr = displayInfo.version
  const commitTimeText = mounted ? formatTime(displayInfo.commitTime) : '--:--'
  const buildTimeText = mounted ? formatTime(displayInfo.buildTime) : '--:--'

  return (
    <>
      <div className="absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] left-2 z-10 pointer-events-none md:bottom-2">
        <Button
          variant="ghost"
          size="sm"
          className="pointer-events-auto h-6 px-2 text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-transparent"
          onClick={() => setOpen(true)}
        >
          {versionStr}
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{t('version.version')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('version.version')}</span>
              <span className="font-mono">{displayInfo.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('version.commit')}</span>
              <span className="font-mono">{displayInfo.commit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('version.commitCount')}</span>
              <span className="font-mono">{displayInfo.count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('version.commitTime')}</span>
              <span className="font-mono">{commitTimeText}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('version.buildTime')}</span>
              <span className="font-mono">{buildTimeText}</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
