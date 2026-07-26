import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getAlternates } from '@/lib/metadata'
import { loadRouteShellMessages } from '@/i18n/load-messages'
import { RouteMessages } from '@/components/shared/route-messages'
import type { WikiLocale } from '@/types/wiki'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('settings.title'),
    description: t('meta.settingsDescription'),
    keywords: t('meta.settingsKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'settings'),
    openGraph: {
      title: `${t('settings.title')} - ${t('app.name')}`,
      description: t('meta.settingsDescription'),
      images: [`/og/settings/${locale}.png`],
    },
  }
}

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = loadRouteShellMessages(locale as WikiLocale, 'settings')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
