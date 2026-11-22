'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { VersionCard } from './version-card'
import type { VersionInfo } from '@/types/version'

export interface VersionComparisonProps {
  /** Baked version of the page that is currently loaded. */
  localInfo: VersionInfo | null
  /** Deployed version.json; null until the first fetch (or when it fails). */
  remoteInfo: VersionInfo | null
  isUpdateAvailable: boolean
}

/**
 * Local → cloud version cards. Once the deployed version.json has loaded, both
 * cards are shown (including the game data rows); the update banner still only
 * appears when the site itself has a newer commit/build.
 */
export function VersionComparison({ localInfo, remoteInfo, isUpdateAvailable }: VersionComparisonProps) {
  const t = useTranslations()
  if (!localInfo) return null

  if (!remoteInfo) {
    return (
      <div className="mb-6">
        <div className="mb-4">
          <VersionCard label={t('version.local')} info={localInfo} />
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <VersionCard label={t('version.local')} info={localInfo} />
        <ArrowRight className="size-5 text-muted-foreground shrink-0" />
        <VersionCard label={t('version.remote')} info={remoteInfo} />
      </div>
      {isUpdateAvailable && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950 p-3">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {t('version.updateAvailable')}
          </span>
        </div>
      )}
    </div>
  )
}
