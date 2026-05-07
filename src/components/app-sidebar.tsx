'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  useSidebar,
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
  RefreshCw,
} from 'lucide-react'
import { Icon } from '@iconify/react'
import { LanguageSwitcher } from './language-switcher'
import { AuthDialog } from './shared/auth-dialog'
import { useVersion } from '@/hooks/use-version'
import { formatTime } from '@/lib/utils'
import { ForceUpgradeDialog } from './shared/force-upgrade-dialog'

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
  const { isUpdateAvailable, info, localInfo, forceUpgrade, refreshPage } = useVersion()
  const { state } = useSidebar()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const refreshBtnRef = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  const updatePopupPos = useCallback(() => {
    if (!refreshBtnRef.current) return
    const rect = refreshBtnRef.current.getBoundingClientRect()
    setPopupPos({ top: rect.top + rect.height / 2, left: rect.right + 10 })
  }, [])

  useEffect(() => {
    if (!mounted || state !== 'collapsed' || !isUpdateAvailable || !refreshBtnRef.current) return

    const el = refreshBtnRef.current
    const ro = new ResizeObserver(() => updatePopupPos())
    ro.observe(el)

    updatePopupPos()

    return () => ro.disconnect()
  }, [mounted, state, isUpdateAvailable, updatePopupPos])

  const versionStr = localInfo?.version ?? info?.version ?? ''
  const versionMajorMinor = versionStr ? versionStr.split('-')[0].split('.').slice(0, 2).join('.') : ''
  const versionBuildTime = localInfo?.buildTime ?? info?.buildTime ?? ''

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
          {isUpdateAvailable && (
            <SidebarMenuItem>
              <div ref={refreshBtnRef}>
                <SidebarMenuButton
                  onClick={refreshPage}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                >
                  <RefreshCw className="size-4" />
                  <span>{t('version.updatePrompt')}</span>
                </SidebarMenuButton>
              </div>
              {mounted && state === 'collapsed' && createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: popupPos.top,
                    left: popupPos.left,
                    transform: 'translateY(-50%)',
                    zIndex: 9999,
                  }}
                  className="bg-amber-500 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow-[0_0_18px_rgba(245,158,11,0.5)] transition-transform hover:scale-105 whitespace-nowrap"
                >
                  {/* Arrow pointing left toward the button */}
                  <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-amber-500" />
                  {t('version.updatePrompt')}
                </div>,
                document.body
              )}
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={`/${locale}/update`} />}
              tooltip={t('nav.update')}
            >
              <Download />
              {versionStr ? (
                <span className="text-[11px] leading-tight">
                  <span>{t('version.compatibleVersion')}: {versionMajorMinor}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {versionBuildTime ? formatTime(versionBuildTime) : ''} | {versionStr}
                  </span>
                </span>
              ) : (
                <span>{t('nav.update')}</span>
              )}
            </SidebarMenuButton>
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
        {forceUpgrade && <ForceUpgradeDialog />}
    </Sidebar>
  )
}
