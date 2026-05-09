'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'

interface GreetingSectionProps {
  greetingKey: string
}

export function GreetingSection({ greetingKey }: GreetingSectionProps) {
  const t = useTranslations()
  const locale = useLocale()

  const todayStr = useMemo(() => {
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
  }, [locale])

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
