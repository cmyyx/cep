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
    title: t('nav.login'),
    description: t('meta.loginDescription'),
    keywords: t('meta.loginKeywords').split(',').map((k) => k.trim()).filter(Boolean),
    alternates: getAlternates(locale, 'login'),
    openGraph: {
      title: `${t('nav.login')} - ${t('app.name')}`,
      description: t('meta.loginDescription'),
      images: [`/og/login/${locale}.png`],
    },
  }
}

export default async function LoginLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // auth 全量 + account (登录页功能对比表/清除会话等)
  const messages = loadRouteShellMessages(locale as WikiLocale, 'login')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
