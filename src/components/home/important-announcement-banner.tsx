'use client'

import { useTranslations, useLocale } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { NavLink } from '@/components/shared/nav-link'
import { useImportantUnreadCount } from '@/stores/useAnnouncementStore'

export function ImportantAnnouncementBanner() {
  const t = useTranslations()
  const locale = useLocale()
  const count = useImportantUnreadCount()

  if (count === 0) return null

  return (
    <NavLink
      href={`/${locale}`}
      loadingLabel={t('app.name')}
      className="block"
    >
      <div className="flex items-center justify-center gap-2.5 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950 transition-colors">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-50" />
          <span className="relative inline-flex rounded-full size-2 bg-amber-500" />
        </span>
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t('home.importantBanner', { count })}
        </span>
        <span className="text-xs underline underline-offset-2 text-amber-600 dark:text-amber-400">
          {t('home.clickToView')}
        </span>
      </div>
    </NavLink>
  )
}
