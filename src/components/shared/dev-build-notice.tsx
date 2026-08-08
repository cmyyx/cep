'use client'

import { useTranslations } from 'next-intl'
import { ExternalLink, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface DevBuildNoticeProps {
  siteUrl: string
}

function siteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host
  } catch {
    return siteUrl
  }
}

export function DevBuildNotice({ siteUrl }: DevBuildNoticeProps) {
  const t = useTranslations('devBuildNotice')

  return (
    <div
      data-dev-build-notice
      data-nosnippet
      role="alert"
      className={cn(
        'flex shrink-0 items-start gap-2.5 px-4 py-2.5 text-sm',
        'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
        'shadow-[var(--shadow-border-inset-b)]',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-relaxed">{t('title')}</p>
        <p className="text-[13px] leading-relaxed opacity-80">{t('description', { site: siteHost(siteUrl) })}</p>
      </div>
      <Button
        nativeButton={false}
        size="sm"
        variant="outline"
        className="shrink-0 bg-transparent"
        render={<a href={siteUrl} target="_blank" rel="noopener noreferrer" />}
      >
        <ExternalLink data-icon="inline-start" />
        {t('openOfficial')}
      </Button>
    </div>
  )
}

export default DevBuildNotice
