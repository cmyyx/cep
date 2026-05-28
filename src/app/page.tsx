'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BootstrapScreen } from '@/components/shared/bootstrap-screen'
import { getExplicitLanguage, detectBrowserLocale } from '@/lib/locale-utils'

/**
 * Root route handler.
 *
 * Renders a branded splash screen while detecting the user's locale,
 * then redirects to /[locale].
 */
export default function RootRedirect() {
  const router = useRouter()

  useEffect(() => {
    const locale = getExplicitLanguage() ?? detectBrowserLocale()
    router.replace(`/${locale}`)
  }, [router])

  return <BootstrapScreen />
}
