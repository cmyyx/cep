'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import {
  getExplicitLanguage,
  detectBrowserLocale,
  buildLocaleHref,
} from '@/lib/locale-utils'

/**
 * Guards against locale mismatch between URL and user preference.
 *
 * On mount, reads language preference directly from localStorage
 * (bypassing Zustand hydration timing) and redirects if the URL
 * locale differs from the effective language.
 *
 * Does not render any UI.
 */
export function LocaleGuard() {
  const urlLocale = useLocale()

  useEffect(() => {
    document.documentElement.lang = urlLocale
  }, [urlLocale])

  useEffect(() => {
    const explicit = getExplicitLanguage()
    const effective = explicit ?? detectBrowserLocale()
    if (effective !== urlLocale) {
      window.location.replace(buildLocaleHref(effective))
    }
  }, [urlLocale])

  return null
}
