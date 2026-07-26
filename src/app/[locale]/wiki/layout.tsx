import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
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
    // 完整官方游戏名作为 wiki 标题后缀 (SEO): 子页面经 template 得到
    // "干员 - 明日方舟:终末地 WIKI" 形态
    title: {
      template: `%s - ${t('meta.wikiTitle')}`,
      default: t('meta.wikiTitle'),
    },
    description: t('meta.wikiDescription'),
    keywords: t('meta.wikiKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    openGraph: {
      title: `${t('meta.wikiTitle')} - ${t('app.name')}`,
      description: t('meta.wikiDescription'),
      images: [`/og/wiki/${locale}.png`],
    },
  }
}

export default async function WikiLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // wiki 客户端孤岛 (grid/detail islands) + 装备型号后缀 refinement.modelType*
  const messages = loadRouteShellMessages(locale as WikiLocale, 'wiki')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
