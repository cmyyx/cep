'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BootstrapScreen } from '@/components/shared/bootstrap-screen'
import { getExplicitLanguage, detectBrowserLocale } from '@/lib/locale-utils'
import type { SupportedLocale } from '@/lib/locale-utils'

const REDIRECT_TIMEOUT = 10_000

/**
 * Root route handler.
 *
 * Renders a branded splash screen while detecting the user's locale,
 * then redirects to /[locale].
 *
 * Includes detailed logging (captured by debug system) and a 10s timeout
 * with fallback redirect via location.replace.
 */
export default function RootRedirect() {
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)
  const [status, setStatus] = useState<string>('init')

  useEffect(() => {
    const startTime = Date.now()
    let redirected = false
    let routerInitiated = false
    let mounted = true
    let innerTimeoutId: ReturnType<typeof setTimeout> | undefined

    const log = (step: string, data?: Record<string, unknown>) => {
      console.log('[RootRedirect]', step, data ?? '')
      if (mounted) setStatus(step)
    }

    const fallbackRedirect = (locale: SupportedLocale) => {
      if (redirected) return
      redirected = true
      log('fallback-redirect', { locale, method: 'location.replace' })
      window.location.replace(`/${locale}`)
    }

    const performRedirect = () => {
      try {
        const explicit = getExplicitLanguage()
        log('explicit-language', { value: explicit })

        const browserLocale = detectBrowserLocale()
        log('browser-locale', { value: browserLocale })

        const locale = explicit ?? browserLocale
        log('final-locale', { locale, source: explicit ? 'explicit' : 'browser' })

        log('router-replace-start', { target: `/${locale}` })
        router.replace(`/${locale}`)
        routerInitiated = true
        log('router-replace-called')

        innerTimeoutId = setTimeout(() => {
          if (mounted && !redirected && window.location.pathname === '/') {
            log('router-replace-ineffective', { currentPath: window.location.pathname })
            fallbackRedirect(locale)
          }
        }, 2000)
      } catch (error) {
        log('error', {
          message: String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        fallbackRedirect('zh-CN')
      }
    }

    const timeoutId = setTimeout(() => {
      if (!redirected && !routerInitiated) {
        log('timeout', { elapsed: Date.now() - startTime })
        if (mounted) setTimedOut(true)
        const locale = getExplicitLanguage() ?? detectBrowserLocale()
        fallbackRedirect(locale)
      }
    }, REDIRECT_TIMEOUT)

    log('init', {
      url: window.location.href,
      userAgent: navigator.userAgent,
      localStorage: typeof localStorage !== 'undefined' ? 'available' : 'blocked',
    })
    performRedirect()

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      clearTimeout(innerTimeoutId)
    }
  }, [router])

  return <BootstrapScreen timedOut={timedOut} status={status} />
}
