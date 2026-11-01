'use client'

import { useState } from 'react'
import { shouldHideAdsForUser } from '@/lib/ads'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * Whether the current visitor is ad-free.
 *
 * The clock is captured once per mount: membership expiry during a long session
 * is rare, and reading Date.now() on every render would make the component
 * impure. A purchase updates the store and therefore takes effect immediately;
 * only an expiry that happens while the page stays open waits for the next load.
 */
export function useShouldHideAds(): boolean {
  const premiumUntil = useAuthStore((s) => s.premiumUntil)
  const premiumPreGrantedUntil = useAuthStore((s) => s.premiumPreGrantedUntil)
  const premiumTrialUntil = useAuthStore((s) => s.premiumTrialUntil)
  const [mountedAt] = useState(() => Date.now())

  return shouldHideAdsForUser(
    { premiumUntil, premiumPreGrantedUntil, premiumTrialUntil },
    mountedAt,
  )
}
