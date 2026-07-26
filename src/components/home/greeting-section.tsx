'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations, useLocale } from 'next-intl'

interface GreetingSectionProps {
  greetingKey: string
}

function formatDateStr(locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(new Date())
  } catch {
    return ''
  }
}

/** Stable placeholder used during SSR/hydration to avoid mismatch. */
const PLACEHOLDER_DATE = ''

/** Stable greeting used during SSR/hydration to avoid mismatch. */
export const PLACEHOLDER_GREETING = 'home.greetingMorning'

/** Every greeting bucket key, in chronological order. */
export const GREETING_KEYS = [
  'home.greetingNight',
  'home.greetingMorning',
  'home.greetingNoon',
  'home.greetingAfternoon',
  'home.greetingEvening',
] as const

/**
 * Map a 0-23 clock hour to a greeting key. The buckets must tile the whole day:
 * morning runs to 11:00 so 09:00-10:59 is not silently treated as evening.
 *
 * Lives here rather than in the home page module because Next 16 type-checks
 * App Router page files against an allowlist of exports (`default`, `metadata`,
 * `generateStaticParams`, …) — an extra named export there is a build error, so
 * the bucket logic would be untestable if it stayed inline in the page. The key
 * literals must also stay in a file that calls `t()` so check-i18n.mjs can
 * resolve `t(greetingKey)` below.
 */
export function getGreetingKey(hour: number): string {
  if (hour < 5) return 'home.greetingNight'
  if (hour < 11) return 'home.greetingMorning'
  if (hour < 13) return 'home.greetingNoon'
  if (hour < 18) return 'home.greetingAfternoon'
  return 'home.greetingEvening'
}

export function GreetingSection({ greetingKey }: GreetingSectionProps) {
  const t = useTranslations()
  const locale = useLocale()

  // useSyncExternalStore: server snapshot is the empty string (no Date()
  // during SSG), client snapshot is the real formatted date. React
  // handles the transition from server→client without hydration errors.
  const todayStr = useSyncExternalStore(
    // Re-check every 60s so date updates near midnight
    (onStoreChange) => {
      const id = setInterval(onStoreChange, 60_000)
      return () => clearInterval(id)
    },
    () => formatDateStr(locale),
    () => PLACEHOLDER_DATE,
  )

  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-[-0.96px] text-foreground">
        {t(greetingKey)}
      </h2>
      {todayStr && (
        <p className="text-sm text-muted-foreground">{todayStr}</p>
      )}
    </div>
  )
}
