'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { getExplicitLanguage, buildLocaleHref } from '@/lib/locale-utils'

/**
 * Guards against locale mismatch when the user has an explicit language preference.
 *
 * - Explicit language set (e.g. 'zh-CN'): redirects to match the preference.
 * - AUTO: does nothing — the URL locale is respected. Initial `/` → `/[locale]`
 *   redirect is handled by RootRedirect (`src/app/page.tsx`).
 */
export function LocaleGuard() {
  const urlLocale = useLocale()

  useEffect(() => {
    document.documentElement.lang = urlLocale
  }, [urlLocale])

  useEffect(() => {
    const explicit = getExplicitLanguage()
    if (explicit && explicit !== urlLocale) {
      window.location.replace(buildLocaleHref(explicit))
    }
  }, [urlLocale])

  return null
}
