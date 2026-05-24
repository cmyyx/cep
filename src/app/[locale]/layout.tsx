import { NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Background } from '@/components/background'
import { ThemeProvider } from '@/components/theme-provider'
import { NavigationListener } from '@/components/shared/navigation-listener'
import { NavigationLoadingOverlay } from '@/components/shared/navigation-loading-overlay'
import { NavigationProgressBar } from '@/components/shared/navigation-progress-bar'
import { AppInitOverlay } from '@/components/shared/app-init-overlay'
import { ImportantAnnouncementBanner } from '@/components/home/important-announcement-banner'
import { AnnouncementLoader } from '@/components/home/announcement-loader'
import { SyncManager } from '@/components/shared/sync-manager'
import { LegacyMigrationDialog } from '@/components/shared/legacy-migration-dialog'
import { DomainGuard } from '@/components/shared/domain-guard'
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
  const t = await getTranslations({ locale })
  const siteUrl = process.env.SITE_URL || 'https://cep.example.com'
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

  const messages = (await import(`../../messages/${locale}.json`)).default
  // Merge game content translations from auto-generated i18n files
  // Each category is loaded conditionally — files may not exist on first build
  const loadGameI18n = async (category: string) => {
    try {
      return (await import(`../../generated/i18n/${category}/${locale}.json`)).default
    } catch { return {} }
  }
  messages.weapons = await loadGameI18n('weapons')
  messages.equips = await loadGameI18n('equips')
  messages.dungeons = await loadGameI18n('dungeons')
  messages.stats = await loadGameI18n('stats')
  messages.region = await loadGameI18n('regions')
  messages.equipTypes = await loadGameI18n('equipTypes')
  messages.materials = await loadGameI18n('materials')
  messages.suits = await loadGameI18n('suits')

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <DomainGuard />
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
              {/* Navigation progress bar — immediate feedback on every nav */}
              <NavigationProgressBar />
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
