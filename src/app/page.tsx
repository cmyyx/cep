'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BootstrapScreen } from '@/components/shared/bootstrap-screen'

const SUPPORTED = ['zh-CN', 'zh-TW', 'ja', 'en'] as const

function detectLocale(): string {
  if (typeof window === 'undefined') return 'zh-CN'
  // 1. Check localStorage for explicit user preference (non-'auto')
  try {
    const raw = localStorage.getItem('cep-settings')
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'language' in parsed) {
        const lang = (parsed as Record<string, unknown>).language
        if (typeof lang === 'string' && lang !== 'auto' && (SUPPORTED as readonly string[]).includes(lang)) {
          return lang
        }
      }
    }
  } catch { /* ignore */ }
  // 2. Fallback to browser language
  const browser = navigator.language
  if (SUPPORTED.includes(browser as (typeof SUPPORTED)[number])) return browser
  const prefix = browser.split('-')[0]
  const match = SUPPORTED.find((l) => l.startsWith(prefix))
  return match ?? 'zh-CN'
}

/**
 * Root route handler.
 *
 * Renders a branded splash screen while detecting the user's locale,
 * then redirects to /[locale].
 */
export default function RootRedirect() {
  const router = useRouter()

  useEffect(() => {
    const locale = detectLocale()
    router.replace(`/${locale}`)
  }, [router])

  return <BootstrapScreen />
}
