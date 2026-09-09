'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { GameI18nLookupPanel } from '@/components/tools/game-i18n-lookup-panel'

export default function GameI18nLookupPage() {
  const t = useTranslations('gameI18nLookup')
  return (
    <div className="flex flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border)]">
        <SidebarTrigger />
        <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{t('title')}</h1>
      </header>
      <GameI18nLookupPanel />
    </div>
  )
}
