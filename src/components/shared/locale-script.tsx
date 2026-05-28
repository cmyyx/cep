'use client'

import { useEffect } from 'react'

/**
 * Sets document.documentElement.lang on the client.
 * This replaces the server-side <HeadScript> approach which doesn't work
 * in Next.js 16 + React 19 (scripts inside React components are never executed
 * when rendering on the client).
 */
export function LocaleScript({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}
