'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { formatTime } from '@/lib/utils'
import type { VersionInfo } from '@/types/version'

export interface VersionCardProps {
  label: string
  info: VersionInfo
}

/**
 * Site version card. The game data rows are display-only: they come from the
 * baked snapshot in version-data.ts / version.json and never feed the update
 * check (commit + buildTime still decide that).
 */
export function VersionCard({ label, info }: VersionCardProps) {
  const t = useTranslations()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const commitTimeText = mounted ? formatTime(info.commitTime) : '--:--'
  const buildTimeText = mounted ? formatTime(info.buildTime) : '--:--'
  const publishedAt = info.gameData?.publishedAt ?? null
  const publishedAtText = publishedAt
    ? (mounted ? formatTime(publishedAt) : '--:--')
    : '—'

  return (
    <div className="flex-1 rounded-lg shadow-[var(--shadow-border)] p-4">
      <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide text-center">{label}</h3>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">{t('version.version')}</span>
          <span className="min-w-0 break-all text-right text-sm font-mono font-medium">{info.version}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">{t('version.commit')}</span>
          <span className="min-w-0 break-all text-right text-sm font-mono">{info.commit}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.commitCount')}</span>
          <span className="text-sm font-mono">{info.count}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.commitTime')}</span>
          <span className="text-sm font-mono">{commitTimeText}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.buildTime')}</span>
          <span className="text-sm font-mono">{buildTimeText}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">{t('version.gameDataVersion')}</span>
          <span className="min-w-0 break-all text-right text-sm font-mono font-medium">{info.gameData?.version ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('version.gameDataPublishedAt')}</span>
          <span className="text-sm font-mono">{publishedAtText}</span>
        </div>
      </div>
    </div>
  )
}
