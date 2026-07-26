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
    title: { absolute: t('app.name') },
    description: t('meta.homeDescription'),
    keywords: t('meta.homeKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale),
    openGraph: {
      title: t('app.name'),
      description: t('meta.homeDescription'),
      images: [`/og/home/${locale}.png`],
    },
  }
}

export default async function HomeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = loadRouteShellMessages(locale as WikiLocale, '(home)')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
