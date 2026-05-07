'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'

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
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('home.welcome')}
        </h1>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-lg text-muted-foreground">
            {t(greetingKey)}
          </p>
        </div>
      </div>
    </div>
  )
}
