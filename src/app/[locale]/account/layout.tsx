import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { getAlternates } from '@/lib/metadata'
import { loadPlannerCatalogs, loadRouteShellMessages } from '@/i18n/load-messages'
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
    title: t('account.title'),
    description: t('meta.accountDescription'),
    keywords: t('meta.accountKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'account'),
    openGraph: {
      title: `${t('account.title')} - ${t('app.name')}`,
      description: t('meta.accountDescription'),
      images: [`/og/account/${locale}.png`],
    },
  }
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Account/auth 命名空间 + sync 冲突 UI 的 equips/region 目录, 仅注入本路由。
  const messages = {
    ...loadRouteShellMessages(locale as WikiLocale, 'account'),
    ...loadPlannerCatalogs(locale as WikiLocale, 'account'),
  }
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
