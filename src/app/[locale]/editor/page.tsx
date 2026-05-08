'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'

export default function EditorPage() {
  const t = useTranslations()

  return (
    <div className="flex flex-col flex-1">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">{t('nav.editor')}</h1>
      </div>
    </div>
  )
}
