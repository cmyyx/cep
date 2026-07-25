'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { parseBrowserInfo } from '@/lib/browser-info'
import { formatTime } from '@/lib/utils'
import type { VersionInfo } from '@/types/version'

export interface GuardEnvironmentInfoProps {
  versionInfo: VersionInfo | null
}

const subscribe = () => () => {}

export function GuardEnvironmentInfo({ versionInfo }: GuardEnvironmentInfoProps) {
  const t = useTranslations()
  const userAgent = useSyncExternalStore(
    subscribe,
    () => navigator.userAgent,
    () => '',
  )
  const browserInfo = userAgent ? parseBrowserInfo(userAgent) : null

  return (
    <dl className="grid max-w-full grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-left font-mono text-[11px] leading-4 text-muted-foreground/60">
      <dt>{t('environment.browser')}</dt>
      <dd className="min-w-0 break-words text-foreground/65">{browserInfo?.browser ?? '--'}</dd>
      <dt>{t('environment.engine')}</dt>
      <dd className="min-w-0 break-words text-foreground/65">{browserInfo?.engine ?? '--'}</dd>
      {versionInfo ? (
        <>
          <dt>{t('version.version')}</dt>
          <dd className="min-w-0 break-all text-foreground/65">{versionInfo.version}</dd>
          <dt>{t('version.commitCount')}</dt>
          <dd className="min-w-0 text-foreground/65">{versionInfo.count}</dd>
          <dt>{t('version.commitTime')}</dt>
          <dd className="min-w-0 text-foreground/65">{formatTime(versionInfo.commitTime)}</dd>
          <dt>{t('version.buildTime')}</dt>
          <dd className="min-w-0 text-foreground/65">{formatTime(versionInfo.buildTime)}</dd>
        </>
      ) : null}
    </dl>
  )
}

export default GuardEnvironmentInfo
