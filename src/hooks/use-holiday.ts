'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import {
  getActiveHoliday,
  getChineseYearNumber,
  getEnglishOrdinal,
  type ActiveHoliday,
} from '@/lib/holidays'
import { useHolidayStore } from '@/stores/useHolidayStore'

export interface UseHolidayResult {
  activeHoliday: ActiveHoliday | null
  dismiss: () => void
  enabled: boolean
  toggleEnabled: () => void
  now: Date
  yearText: string
}

export function useHoliday(): UseHolidayResult {
  const enabled = useHolidayStore((s) => s.holidayEffectsEnabled)
  const dismissedHolidays = useHolidayStore((s) => s.dismissedHolidays)
  const dismissHoliday = useHolidayStore((s) => s.dismissHoliday)
  const toggleEnabled = useHolidayStore((s) => s.toggleHolidayEffects)
  const locale = useLocale()

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled || !mounted) return

    const tick = () => setNow(new Date())
    const active = getActiveHoliday(now)
    const interval = active?.phase === 'countdown' ? 1000 : 60_000

    const timer = setInterval(tick, interval)
    return () => clearInterval(timer)
  }, [enabled, mounted, now])

  const active = getActiveHoliday(now)
  const year = now.getFullYear()
  const isDismissed = active
    ? dismissedHolidays[active.config.id] === year
    : true

  const dismiss = useCallback(() => {
    if (active) dismissHoliday(active.config.id, year)
  }, [active, year, dismissHoliday])

  const yearText = active?.yearNumber != null
    ? formatYearText(active.yearNumber, locale)
    : ''

  return {
    activeHoliday: enabled && !isDismissed ? active : null,
    dismiss,
    enabled,
    toggleEnabled,
    now,
    yearText,
  }
}

function formatYearText(yearNumber: number, locale: string): string {
  if (locale.startsWith('zh')) return getChineseYearNumber(yearNumber)
  if (locale === 'ja') return getChineseYearNumber(yearNumber)
  return getEnglishOrdinal(yearNumber)
}
