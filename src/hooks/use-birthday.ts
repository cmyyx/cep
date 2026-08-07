'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { characterBirthdays } from '@/generated/data/wiki/character-birthdays'
import { getBirthdayCharacterIds, getBirthdayDismissKey } from '@/lib/operator-birthdays'
import { useHolidayStore } from '@/stores/useHolidayStore'

export interface UseBirthdayResult {
  /** Operator ids whose birthday is today (empty when dismissed or disabled). */
  characterIds: string[]
  dismiss: () => void
  now: Date
}

/**
 * Today's operator birthdays. Shares the holiday banner store on purpose:
 * dismissal keys (`birthday-{m}-{d}`) and the effects toggle live in the same
 * persisted `cep-holiday` state, so closing a birthday hides it for the rest
 * of the year and `holidayEffectsEnabled` gates both banners.
 */
export function useBirthday(): UseBirthdayResult {
  const enabled = useHolidayStore((s) => s.holidayEffectsEnabled)
  const dismissedHolidays = useHolidayStore((s) => s.dismissedHolidays)
  const dismissHoliday = useHolidayStore((s) => s.dismissHoliday)

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled || !mounted) return
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [enabled, mounted])

  const computedIds = useMemo(() => getBirthdayCharacterIds(now, characterBirthdays), [now])
  const year = now.getFullYear()
  const dismissKey = computedIds.length > 0 ? getBirthdayDismissKey(now) : null
  const isDismissed = dismissKey ? dismissedHolidays[dismissKey] === year : true

  const dismiss = useCallback(() => {
    if (dismissKey) dismissHoliday(dismissKey, year)
  }, [dismissKey, year, dismissHoliday])

  return {
    // Empty until mounted: server-rendered markup must not depend on the
    // (build-time) date, or the banner would be baked into static HTML and
    // mismatch hydration once the client date differs.
    characterIds: mounted && enabled && !isDismissed ? computedIds : [],
    dismiss,
    now,
  }
}
