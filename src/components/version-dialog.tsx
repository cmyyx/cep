'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { VersionInfo } from '@/types/version'
import { useVersion } from '@/hooks/use-version'
import { formatTime } from '@/lib/utils'

type VersionRow = [string, string] | [string, string, string]

function versionRows(t: ReturnType<typeof useTranslations<'version'>>, info: VersionInfo): VersionRow[] {
  return [
    [t('version'), info.version || t('unknown')],
    [t('commit'), info.commit || t('unknown')],
    [t('commitCount'), String(info.count)],
    [t('commitMessage'), info.message || t('unknown')],
    [t('commitTime'), info.commitTime ? formatTime(info.commitTime) : t('unknown')],
    [t('buildTime'), info.buildTime ? formatTime(info.buildTime) : t('unknown')],
  ]
}

interface VersionDialogProps {
  info: VersionInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionDialog({ info, open, onOpenChange }: VersionDialogProps) {
  const t = useTranslations('version')
  const { localInfo, isUpdateAvailable, checkNow, refreshPage } = useVersion()

  if (!info) return null

  const showCompare = isUpdateAvailable && localInfo
  const remoteRows = info ? versionRows(t, info) : []
  const localRows = showCompare && localInfo ? versionRows(t, localInfo) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('label')}</DialogTitle>
        </DialogHeader>

        {showCompare ? (
          <>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 pb-1">
              {t('updateAvailable')}
            </div>
            <div className="grid grid-cols-[80px_1fr_1fr] gap-x-2 gap-y-1 text-xs">
              <span className="text-muted-foreground" />
              <span className="text-muted-foreground font-medium">{t('local')}</span>
              <span className="text-muted-foreground font-medium">{t('remote')}</span>
              {remoteRows.map((row, i) => {
                const localVal = localRows[i]?.[1] ?? t('unknown')
                const remoteVal = row[1] as string
                const changed = localVal !== remoteVal
                return (
                  <React.Fragment key={row[0] as string}>
                    <span className="text-muted-foreground truncate">{row[0]}</span>
                    <span
                      className={`font-mono truncate ${changed ? 'text-red-600 dark:text-red-400' : ''}`}
                      title={localVal}
                    >
                      {localVal}
                    </span>
                    <span
                      className={`font-mono truncate ${changed ? 'text-green-600 dark:text-green-400 font-medium' : ''}`}
                      title={remoteVal}
                    >
                      {remoteVal}
                    </span>
                  </React.Fragment>
                )
              })}
            </div>
            <Separator />
            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkNow}
                className="flex-1 text-xs h-8"
              >
                {t('checkUpdate')}
              </Button>
              <Button
                size="sm"
                onClick={refreshPage}
                className="flex-1 text-xs h-8"
              >
                {t('clickToRefresh')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 py-2">
              {versionRows(t, info).map(([label, value]) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="max-w-[200px] truncate font-mono text-xs" title={value}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkNow}
                className="w-full text-xs h-8"
              >
                {t('checkUpdate')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
