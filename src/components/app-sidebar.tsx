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
  Download,
  Info,
} from 'lucide-react'
import { Icon } from '@iconify/react'
import { LanguageSwitcher } from './language-switcher'
import { AuthDialog } from './shared/auth-dialog'
import { useVersion } from '@/hooks/use-version'

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
  const { isUpdateAvailable } = useVersion()

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
            <div className="relative">
              <SidebarMenuButton
                render={<Link href={`/${locale}/update`} />}
                className={isUpdateAvailable ? 'group-data-[collapsible=icon]:animate-pulse group-data-[collapsible=icon]:shadow-[0_0_0_1px_rgba(239,68,68,0.5)]' : ''}
              >
                <Download />
                <span>{t('nav.update')}</span>
                {isUpdateAvailable && (
                  <span className="ml-auto text-xs text-blue-500 font-medium">
                    发现新版本
                  </span>
                )}
              </SidebarMenuButton>
              {isUpdateAvailable && (
                <div className="hidden group-data-[collapsible=icon]:block absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-foreground text-background text-xs whitespace-nowrap z-50">
                  发现新版本
                </div>
              )}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={`/${locale}/settings`} />}
            >
              <Settings />
              <span>{t('nav.settings')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={`/${locale}/about`} />}
            >
              <Info />
              <span>{t('nav.about')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center w-full">
              <AuthDialog showLabel />
              <SidebarMenuButton
                render={<a href="https://github.com/cmyyx/cep" target="_blank" rel="noopener noreferrer" />}
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
