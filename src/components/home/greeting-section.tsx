'use client'

import { useEffect, useState, useCallback } from 'react'
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

export function GreetingSection({ greetingKey }: GreetingSectionProps) {
  const t = useTranslations()
  const locale = useLocale()

  const [todayStr, setTodayStr] = useState(() => formatDateStr(locale))

  const updateDate = useCallback(() => {
    const next = formatDateStr(locale)
    setTodayStr((prev) => (prev !== next ? next : prev))
  }, [locale])

  useEffect(() => {
    // Periodic re-check so the date updates within 60s of midnight
    const interval = setInterval(updateDate, 60_000)
    return () => clearInterval(interval)
  }, [updateDate])

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
