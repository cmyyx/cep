'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Swords,
  Users,
  Wrench,
  Calendar,
  Eye,
  Pen,
  LogIn,
  Home,
  Settings,
} from 'lucide-react'
import { LanguageSwitcher } from './language-switcher'
import { VersionBadge } from './version-badge'

const NAV_ITEMS = [
  { href: '/essence-planner', label: 'nav.essencePlanner', Icon: Swords },
  { href: '/character-guide', label: 'nav.characterGuide', Icon: Users },
  { href: '/refinement-planner', label: 'nav.refinementPlanner', Icon: Wrench },
  { href: '/banner-calendar', label: 'nav.bannerCalendar', Icon: Calendar },
  { href: '/background-preview', label: 'nav.backgroundPreview', Icon: Eye },
  { href: '/editor', label: 'nav.editor', Icon: Pen },
]

export function AppSidebar() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={`/${locale}`} />}
            >
              <Home />
              <span className="font-semibold">{t('app.name')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map(({ href, Icon, label }) => {
              const fullHref = `/${locale}${href}`
              const isActive = pathname.startsWith(fullHref)
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={t(label)}
                    render={<Link href={fullHref} />}
                  >
                    <Icon />
                    <span>{t(label)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-1">
          <LanguageSwitcher />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href={`/${locale}/settings`} />}>
              <Settings />
              <span>设置</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href={`/${locale}/login`} />}>
              <LogIn />
              <span>{t('nav.login')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <VersionBadge />
      </SidebarFooter>
    </Sidebar>
  )
}
