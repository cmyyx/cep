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
    title: t('nav.backgroundPreview'),
    description: t('meta.backgroundPreviewDescription'),
    keywords: t('meta.backgroundPreviewKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'background-preview'),
    openGraph: {
      title: `${t('nav.backgroundPreview')} - ${t('app.name')}`,
      description: t('meta.backgroundPreviewDescription'),
      images: [`/og/background-preview/${locale}.png`],
    },
  }
}

export default async function BackgroundPreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = loadRouteShellMessages(locale as WikiLocale, 'background-preview')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
