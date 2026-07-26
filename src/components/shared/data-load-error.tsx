'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface DataLoadErrorProps {
  onRetry: () => void
  className?: string
}

/**
 * Shared failure panel for deferred data chunks (planner dataset, locale catalogs).
 *
 * The copy lives in the `common` namespace, which is part of the core shell bag
 * (src/i18n/route-shell-messages.json), so any route can mount this without adding a
 * per-route message pick — and no caller has to hand it borrowed strings.
 */
export function DataLoadError({ onRetry, className }: DataLoadErrorProps) {
  const t = useTranslations()
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl bg-muted/35 px-6 text-center shadow-[var(--shadow-border)]',
        className,
      )}
    >
      <AlertCircle className="size-5 text-muted-foreground" />
      <div className="min-w-0">
        <p className="font-medium">{t('common.dataLoadFailed')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('common.dataLoadFailedHint')}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw data-icon="inline-start" />
        {t('common.retry')}
      </Button>
    </div>
  )
}
