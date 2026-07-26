import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAlternates } from '@/lib/metadata'
import { loadRouteShellMessages } from '@/i18n/load-messages'
import { RouteMessages } from '@/components/shared/route-messages'
import type { WikiLocale } from '@/types/wiki'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })
  return {
    title: t('gameI18nLookupTitle'),
    description: t('gameI18nLookupDescription'),
    alternates: getAlternates(locale, 'tools/game-i18n'),
  }
}

export default async function GameI18nLookupLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const messages = loadRouteShellMessages(locale as WikiLocale, 'tools/game-i18n')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
