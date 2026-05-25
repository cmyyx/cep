'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { FEATURES } from '@/lib/features'
import { MessageSquareOff, ExternalLink } from 'lucide-react'

export default function ForumPage() {
  const t = useTranslations()

  if (!FEATURES.forumUrl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <MessageSquareOff className="size-12 opacity-30" />
          <p className="text-sm">{t('forum.unavailable')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)] shrink-0">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight shrink-0">
          {t('nav.forum')}
        </h1>
        <span className="hidden sm:inline text-xs text-muted-foreground">
          {t('forum.openInNewTab')}
        </span>
        <a
          href={FEATURES.forumUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ExternalLink className="size-3" />
          <span className="hidden sm:inline">{t('forum.openDirectly')}</span>
          <span className="inline sm:hidden">{t('forum.openDirectlyShort')}</span>
        </a>
      </div>

      {/* Forum iframe */}
      <iframe
        src={FEATURES.forumUrl}
        className="flex-1 w-full border-none"
        title={t('nav.forum')}
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  )
}
