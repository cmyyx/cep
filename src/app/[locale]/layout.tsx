import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Background } from '@/components/background'
import { ThemeProvider } from '@/components/theme-provider'
import { NavigationListener } from '@/components/shared/navigation-listener'
import { NavigationLoadingOverlay } from '@/components/shared/navigation-loading-overlay'
import { ImportantAnnouncementBanner } from '@/components/home/important-announcement-banner'
import { AnnouncementLoader } from '@/components/home/announcement-loader'
import { VersionProvider } from '@/hooks/use-version'
import { versionData } from '@/generated/version-data'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const messages = (await import(`../../messages/${locale}.json`)).default
  return {
    title: {
      template: `%s - ${messages.app.name}`,
      default: messages.app.name,
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

  const messages = (await import(`../../messages/${locale}.json`)).default

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <VersionProvider initialInfo={versionData}>
        <SidebarProvider>
          <ThemeProvider>
            <AnnouncementLoader />
            <Background />
            <AppSidebar />
            <main className="flex-1 w-full relative overflow-auto">
              <ImportantAnnouncementBanner />
              {children}
              <NavigationLoadingOverlay />
            </main>
            <NavigationListener />
          </ThemeProvider>
        </SidebarProvider>
      </VersionProvider>
    </NextIntlClientProvider>
  )
}
