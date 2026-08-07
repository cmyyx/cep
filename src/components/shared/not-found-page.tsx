'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { NextIntlClientProvider } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FullScreenStatus } from '@/components/shared/full-screen-status'
import { GuardEnvironmentInfo } from '@/components/shared/guard-environment-info'
import { getExplicitLanguage, detectBrowserLocale } from '@/lib/locale-utils'
import type { NotFoundPanel } from '@/lib/not-found-copy'
import type { VersionInfo } from '@/types/version'


type NotFoundPageProps = {
  panels: readonly NotFoundPanel[]
  versionInfo: VersionInfo
}

/**
 * Static root 404 UI. The server component supplies the already-extracted
 * locale copy, while this client boundary only handles path-based selection
 * and the fallback redirect for URLs without a locale segment.
 */
export function NotFoundPage({ panels, versionInfo }: NotFoundPageProps) {
  useEffect(() => {
    const segment = location.pathname.split('/')[1] ?? ''
    const hasLocalePrefix = panels.some(
      (panel) => panel.locale.toLowerCase() === segment.toLowerCase(),
    )
    if (hasLocalePrefix) return

    const preferred = getExplicitLanguage() ?? detectBrowserLocale()
    location.replace('/' + preferred + location.pathname + location.search + location.hash)
  }, [panels])

  return (
    <>
      {panels.map((panel) => (
        <div key={panel.locale} data-notfound-panel={panel.locale}>
          <FullScreenStatus
            title="404"
            heading={panel.title}
            animateIcon
            actions={(
              <Button variant="link" nativeButton={false} render={<Link href={`/${panel.locale}`} />}>
                {panel.homeLink}
              </Button>
            )}
            metadata={(
              <NextIntlClientProvider
                locale={panel.locale}
                messages={panel.metaMessages}
                timeZone="Asia/Shanghai"
              >
                <GuardEnvironmentInfo versionInfo={versionInfo} />
              </NextIntlClientProvider>
            )}
          />
        </div>
      ))}
    </>
  )
}

export default NotFoundPage
