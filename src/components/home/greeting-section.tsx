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
