import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getAlternates } from '@/lib/metadata'
import { loadRouteShellMessages } from '@/i18n/load-messages'
import { RouteMessages } from '@/components/shared/route-messages'
import type { WikiLocale } from '@/types/wiki'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })
  return {
    title: t('nav.panelPreview'),
    description: t('meta.panelPreviewDescription'),
    keywords: t('meta.panelPreviewKeywords').split(',').map((key) => key.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'panel-preview'),
  }
}

export default async function PanelPreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Entity names / wikiData come from game-i18n dynamic catalogs (useWikiTranslations), not ClientProvider.
  const messages = loadRouteShellMessages(locale as WikiLocale, 'panel-preview')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
