'use client'

import { useEffect, useState } from 'react'
import {
  getCachedGameI18nLocale,
  loadGameI18nLocale,
  type GameI18nLocaleBundle,
} from '@/lib/game-i18n-catalogs'
import type { WikiLocale } from '@/types/wiki'

/**
 * Subscribe to per-locale game i18n catalogs (dynamic import + cache).
 * Returns null until the locale bundle has loaded (or cache hit on first paint).
 */
export function useGameI18nLocale(locale: WikiLocale): GameI18nLocaleBundle | null {
  const [bundle, setBundle] = useState<GameI18nLocaleBundle | null>(
    () => getCachedGameI18nLocale(locale) ?? null,
  )

  useEffect(() => {
    let cancelled = false
    const cached = getCachedGameI18nLocale(locale)
    if (cached) {
      setBundle(cached)
      return
    }

    setBundle(null)
    void loadGameI18nLocale(locale).then((next) => {
      if (!cancelled) setBundle(next)
    })

    return () => {
      cancelled = true
    }
  }, [locale])

  return bundle
}
