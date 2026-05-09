'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { GreetingSection } from '@/components/home/greeting-section'
import { OverviewCards } from '@/components/home/overview-cards'
import { AnnouncementPanel } from '@/components/home/announcement-panel'

function getGreetingKey(): string {
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 5) return 'home.greetingNight'
  if (hour >= 5 && hour < 9) return 'home.greetingMorning'
  if (hour >= 11 && hour < 13) return 'home.greetingNoon'
  if (hour >= 13 && hour < 18) return 'home.greetingAfternoon'
  return 'home.greetingEvening'
}

export default function HomePage() {
  const t = useTranslations()
  const greetingKey = useMemo(() => getGreetingKey(), [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('app.name')}
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
          <GreetingSection greetingKey={greetingKey} />
          <Separator />
          <OverviewCards />
          <Separator />
          <AnnouncementPanel />
        </div>
      </div>
    </div>
  )
}
