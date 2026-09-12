'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Copy, ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  onMissingTranslation,
  type MissingTranslationEvent,
} from '@/lib/missing-translation-guard'

export function MissingTranslationNotifier() {
  const t = useTranslations()
  const [event, setEvent] = useState<MissingTranslationEvent | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    return onMissingTranslation((ev) => {
      setEvent(ev)
    })
  }, [])

  if (!event) return null

  const pageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : ''

  const issueTitle = encodeURIComponent(`[Game i18n Missing] ${event.key} (${event.locale})`)
  const issueBody = encodeURIComponent(
    [
      `### Missing Game i18n Key`,
      `- **Key**: \`${event.key}\``,
      `- **Locale**: \`${event.locale}\``,
      `- **Category**: \`${event.category ?? 'unknown'}\``,
      `- **Page**: \`${pageUrl}\``,
      `- **User Agent**: \`${typeof navigator !== 'undefined' ? navigator.userAgent : ''}\``,
    ].join('\n')
  )
  const issueUrl = `https://github.com/cmyyx/cep/issues/new?title=${issueTitle}&body=${issueBody}`

  const handleCopy = async () => {
    const info = JSON.stringify(
      {
        key: event.key,
        locale: event.locale,
        category: event.category,
        url: pageUrl,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      },
      null,
      2
    )
    try {
      await navigator.clipboard.writeText(info)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write failed
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        'fixed bottom-6 left-6 z-[60] max-w-sm rounded-lg bg-popover p-4 text-popover-foreground shadow-[var(--shadow-card)] border border-border animate-toast-in',
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h5 className="text-xs font-semibold leading-none">
              {t('common.missingTranslationTitle')}
            </h5>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
              onClick={() => setEvent(null)}
              aria-label={t('common.close')}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground break-all mb-3 leading-relaxed">
            {t('common.missingTranslationDesc', { key: event.key })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleCopy}
              className="gap-1 text-[11px]"
            >
              <Copy className="size-3" />
              {copied ? t('common.reportCopied') : t('common.copyReportInfo')}
            </Button>
            <a
              href={issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'default', size: 'xs' }), 'gap-1 text-[11px]')}
            >
              <ExternalLink className="size-3" />
              {t('common.reportToGithub')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
