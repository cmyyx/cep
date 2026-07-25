'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FullScreenStatus } from '@/components/shared/full-screen-status'
import { GuardEnvironmentInfo } from '@/components/shared/guard-environment-info'
import { useVersion } from '@/hooks/use-version'

/**
 * Locale-aware 404 page (regular route, NOT the special not-found file).
 *
 * Accessible at /<locale>/404. Rendered via redirect from the root
 * catch-all 404 handler (public/404.html in production, app/not-found.tsx
 * in dev mode).
 *
 * Sits inside [locale]/layout.tsx → full access to NextIntlClientProvider
 * → translations from i18n JSON files, zero hardcoded strings.
 */
export default function NotFoundPage() {
  const locale = useLocale()
  const t = useTranslations()
  const { info, localInfo } = useVersion()
  const displayInfo = localInfo ?? info

  return (
    <FullScreenStatus
      title="404"
      heading={t('notFound.title')}
      animateIcon
      actions={(
        <Button variant="link" nativeButton={false} render={<Link href={`/${locale}`} />}>
          {t('notFound.homeLink')}
        </Button>
      )}
      metadata={<GuardEnvironmentInfo versionInfo={displayInfo} />}
    />
  )
}
