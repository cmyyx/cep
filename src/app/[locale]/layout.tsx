import { NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { loadClientMessages } from '@/i18n/load-messages'
import type { WikiLocale } from '@/types/wiki'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Background } from '@/components/background'
import { ThemeProvider } from '@/components/theme-provider'
import { NavigationListener } from '@/components/shared/navigation-listener'
import { NavigationLoadingOverlay } from '@/components/shared/navigation-loading-overlay'
import { NavigationProgressBar } from '@/components/shared/navigation-progress-bar'
import { AppInitOverlay } from '@/components/shared/app-init-overlay'
import { ImportantAnnouncementBanner } from '@/components/home/important-announcement-banner'
import { HolidayBanner } from '@/components/shared/holiday-banner'
import { AnnouncementLoader } from '@/components/home/announcement-loader'
import { SyncManager } from '@/components/shared/sync-manager'
import { LegacyMigrationDialog } from '@/components/shared/legacy-migration-dialog'
import { DebugLabel } from '@/components/shared/debug-label'
import { LocaleGuard } from '@/components/shared/locale-guard'
import { VersionWatermark } from '@/components/shared/version-watermark'
import { ExtensionCssDetector } from '@/components/shared/extension-css-detector'
import { VersionProvider } from '@/hooks/use-version'
import { SiteUrlProvider } from '@/hooks/use-site-url'
import { versionData } from '@/generated/version-data'
import { DEFAULT_SITE_URL } from '@/lib/constants'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  const siteUrl = DEFAULT_SITE_URL
  return {
    metadataBase: new URL(siteUrl),
    title: {
      template: `%s - ${t('app.name')}`,
      default: t('app.name'),
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  setRequestLocale(locale)

  const siteUrl = DEFAULT_SITE_URL
  const t = await getTranslations({ locale })

  const messages = loadClientMessages(locale as WikiLocale)

  return (
    <>
      <NextIntlClientProvider messages={messages} locale={locale}>
      <LocaleGuard />
      <DebugLabel />
      <SiteUrlProvider url={siteUrl}>
      <VersionProvider initialInfo={versionData}>
        <SidebarProvider className="h-svh">
          <ThemeProvider>
            {/* Curtain — covers everything during init, fades out when ready */}
            <AppInitOverlay />

            <AnnouncementLoader />
            <SyncManager />
            <LegacyMigrationDialog />
            <Background />
            <AppSidebar />
            <main className="flex flex-col flex-1 w-full relative overflow-hidden">
              {/* When JS is disabled, show a lightweight i18n banner.
                  Placed inside <main> so it's clear of the fixed sidebar. */}
              <noscript>
                <div
                  data-nosnippet
                  className="w-full text-left py-2.5 px-4 text-[13px] leading-relaxed bg-amber-50 text-amber-900 border-b border-amber-200"
                >
                  {t('noscript.banner')}
                </div>
              </noscript>
              {/* Navigation progress bar — immediate feedback on every nav */}
              <NavigationProgressBar />
              <HolidayBanner />
              <ImportantAnnouncementBanner />
              <ExtensionCssDetector />
              {children}
              <NavigationLoadingOverlay />
              <VersionWatermark />
            </main>
            <NavigationListener />
          </ThemeProvider>
        </SidebarProvider>
      </VersionProvider>
      </SiteUrlProvider>
    </NextIntlClientProvider>
    </>
  )
}
