import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

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
    openGraph: {
      title: `${t('nav.bannerCalendar')} - ${t('app.name')}`,
      description: t('meta.bannerCalendarDescription'),
      images: [`/og/banner-calendar/${locale}.png`],
    },
  }
}

export default function BannerCalendarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
