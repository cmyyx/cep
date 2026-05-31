'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { GreetingSection } from '@/components/home/greeting-section'
import { RealTimeClock } from '@/components/home/real-time-clock'
import { OverviewCards } from '@/components/home/overview-cards'
import { AnnouncementPanel } from '@/components/home/announcement-panel'
import { StructuredData } from '@/components/shared/structured-data'
import { useSiteUrl } from '@/hooks/use-site-url'

function getGreetingKey(): string {
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 5) return 'home.greetingNight'
  if (hour >= 5 && hour < 9) return 'home.greetingMorning'
  if (hour >= 11 && hour < 13) return 'home.greetingNoon'
  if (hour >= 13 && hour < 18) return 'home.greetingAfternoon'
  return 'home.greetingEvening'
}

/** Stable placeholder used during SSR/hydration to avoid mismatch. */
const PLACEHOLDER_GREETING = 'home.greetingMorning'

export default function HomePage() {
  const t = useTranslations()
  const pathname = usePathname()
  const siteUrl = useSiteUrl()

  // useSyncExternalStore: server snapshot is the stable placeholder (no
  // Date.now() during SSG), client snapshot is the real greeting. React
  // handles the transition from server→client without hydration errors.
  const greetingKey = useSyncExternalStore(
    // Re-check every 60s so greeting updates near time boundaries
    (onStoreChange) => {
      const id = setInterval(onStoreChange, 60_000)
      return () => clearInterval(id)
    },
    () => getGreetingKey(),
    () => PLACEHOLDER_GREETING,
  )

  return (
    <>
      <StructuredData
        type="WebApplication"
        name={t('app.name')}
        description={t('meta.homeDescription')}
        url={`${siteUrl}${pathname}`}
      />
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
          <RealTimeClock />
          <Separator />
          <OverviewCards />
          <Separator />
          <AnnouncementPanel />
        </div>
      </div>
    </div>
    </>
  )
}
