'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'

const SUPPORTED = ['zh-CN', 'zh-TW', 'ja', 'en'] as const
const DEFAULT = 'zh-CN'

/**
 * Reads the user's explicit language preference directly from localStorage,
 * avoiding the Zustand hydration timing race.
 * Returns null when set to 'auto' or not present.
 */
function getExplicitLanguage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('cep-settings')
    if (raw) {
      const s = JSON.parse(raw)
      if (
        s.language &&
        s.language !== 'auto' &&
        (SUPPORTED as readonly string[]).includes(s.language)
      ) {
        return s.language
      }
    }
  } catch {
    /* ignore corrupt data */
  }
  return null
}

function detectBrowserLocale(): string {
  if (typeof window === 'undefined') return DEFAULT
  const nav = navigator.language
  const match = SUPPORTED.find((l) => l.split('-')[0] === nav.split('-')[0])
  return match ?? DEFAULT
}

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
  const router = useRouter()
  const pathname = usePathname()
  const urlLocale = useLocale()

  useEffect(() => {
    const explicit = getExplicitLanguage()
    const effective = explicit ?? detectBrowserLocale()
    if (effective !== urlLocale) {
      router.replace(pathname.replace(`/${urlLocale}`, `/${effective}`))
    }
  }, [urlLocale, pathname, router])

  return null
}
