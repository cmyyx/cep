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
    title: t('nav.bannerCalendar'),
    description: t('meta.bannerCalendarDescription'),
    keywords: t('meta.bannerCalendarKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'banner-calendar'),
    openGraph: {
      title: `${t('nav.bannerCalendar')} - ${t('app.name')}`,
      description: t('meta.bannerCalendarDescription'),
      images: [`/og/banner-calendar/${locale}.png`],
    },
  }
}

export default async function BannerCalendarLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = loadRouteShellMessages(locale as WikiLocale, 'banner-calendar')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
