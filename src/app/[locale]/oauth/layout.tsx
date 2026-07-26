import { loadRouteShellMessages } from '@/i18n/load-messages'
import { RouteMessages } from '@/components/shared/route-messages'
import type { WikiLocale } from '@/types/wiki'

export default async function OAuthLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // oauth 授权页: oauth + auth 命名空间仅注入本路由。
  const messages = loadRouteShellMessages(locale as WikiLocale, 'oauth')
  return <RouteMessages messages={messages}>{children}</RouteMessages>
}
