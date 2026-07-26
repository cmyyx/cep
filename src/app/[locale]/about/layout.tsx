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
    title: t('nav.about'),
    description: t('meta.aboutDescription'),
    keywords: t('meta.aboutKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'about'),
    openGraph: {
      title: `${t('nav.about')} - ${t('app.name')}`,
      description: t('meta.aboutDescription'),
      images: [`/og/about/${locale}.png`],
    },
  }
}

export default async function AboutLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = loadRouteShellMessages(locale as WikiLocale, 'about')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
