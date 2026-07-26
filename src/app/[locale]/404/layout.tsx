import { loadRouteShellMessages } from '@/i18n/load-messages'
import { RouteMessages } from '@/components/shared/route-messages'
import type { WikiLocale } from '@/types/wiki'

export default async function NotFoundLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // notFound + guard 环境信息 (environment/version) 仅注入本路由。
  const messages = loadRouteShellMessages(locale as WikiLocale, '404')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
