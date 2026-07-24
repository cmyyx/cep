'use client'

import { useEffect, useState } from 'react'
import {
  getCachedGameI18nLocale,
  loadGameI18nLocale,
  type GameI18nLocaleBundle,
} from '@/lib/game-i18n-catalogs'
import type { WikiLocale } from '@/types/wiki'

type LoadedEntry = {
  locale: WikiLocale
  bundle: GameI18nLocaleBundle
}

/**
 * Subscribe to per-locale game i18n catalogs (dynamic import + cache).
 *
 * Return value is derived on render from:
 * 1) shared cache for the current locale, or
 * 2) state only when it matches the current locale (ignores stale loads).
 *
 * The effect never writes sync setState for cache hits / resets — it only
 * updates after loadGameI18nLocale resolves (with cancellation).
 */
export function useGameI18nLocale(locale: WikiLocale): GameI18nLocaleBundle | null {
  const [entry, setEntry] = useState<LoadedEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadGameI18nLocale(locale).then((bundle) => {
      if (cancelled) return
      setEntry({ locale, bundle })
    })
    return () => {
      cancelled = true
    }
  }, [locale])

  const cached = getCachedGameI18nLocale(locale)
  if (cached) return cached
  if (entry?.locale === locale) return entry.bundle
  return null
}
