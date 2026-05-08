'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'

export default function CharacterGuidePage() {
  const t = useTranslations()

  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">{t('nav.characterGuide')}</h1>
      </div>
    </div>
  )
}
