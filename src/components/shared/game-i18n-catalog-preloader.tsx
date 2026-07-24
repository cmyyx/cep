'use client'

import { useEffect } from 'react'
import { loadGameI18nLocale } from '@/lib/game-i18n-catalogs'
import { asWikiLocale } from '@/lib/wiki-locale'

export interface GameI18nCatalogPreloaderProps {
  locale: string
}

/**
 * Kicks off per-locale catalog dynamic import as early as the locale layout mounts
 * so wiki/planner hooks usually hit cache instead of flashing raw IDs.
 */
export function GameI18nCatalogPreloader({ locale }: GameI18nCatalogPreloaderProps) {
  useEffect(() => {
    void loadGameI18nLocale(asWikiLocale(locale))
  }, [locale])

  return null
}

export default GameI18nCatalogPreloader
