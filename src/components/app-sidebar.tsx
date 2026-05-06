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
  Home,
  Settings,
} from 'lucide-react'
import { Icon } from '@iconify/react'
import { LanguageSwitcher } from './language-switcher'
import { AuthDialog } from './shared/auth-dialog'

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
              tooltip={t('app.name')}
            >
              <img src="/icon.svg" alt={t('app.name')} className="size-8 rounded-lg" />
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
        <SidebarMenu>
          <SidebarMenuItem>
            <LanguageSwitcher />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href={`/${locale}/settings`} />} tooltip={t('nav.settings')}>
              <Settings />
              <span>{t('nav.settings')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center w-full">
              <AuthDialog showLabel />
              <SidebarMenuButton
                render={<a href="https://github.com/your-project" target="_blank" rel="noopener noreferrer" />}
                className="w-8 flex-shrink-0 group-data-[collapsible=icon]:hidden"
                tooltip="GitHub"
              >
                <Icon icon="octicon:mark-github-16" />
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
