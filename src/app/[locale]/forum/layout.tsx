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
    title: t('nav.forum'),
    description: t('meta.forumDescription'),
    keywords: t('meta.forumKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'forum'),
    openGraph: {
      title: `${t('nav.forum')} - ${t('app.name')}`,
      description: t('meta.forumDescription'),
      images: [`/og/forum/${locale}.png`],
    },
  }
}

export default async function ForumLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = loadRouteShellMessages(locale as WikiLocale, 'forum')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
