'use client'

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { NavLink } from '@/components/shared/nav-link'
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
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  Swords,
  Disc,
  UsersRound,
  Shirt,
  Wrench,
  Calendar,
  ImageDown,
  MessageCircle,
  Settings,
  Download,
  Info,
  RefreshCw,
  LogIn,
  CircleUser,
  AlertTriangle,
  ChartNoAxesCombined,
  PanelsTopLeft,
  Languages,
  ExternalLink,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { FEATURES } from '@/lib/features'
import { useVersion } from '@/hooks/use-version'
import { useAnnouncementStore, useImportantUnreadCount } from '@/stores/useAnnouncementStore'
import { cn, formatTime } from '@/lib/utils'
import { ForceUpgradeDialog } from './shared/force-upgrade-dialog'
import { LanguageSwitcher } from '@/components/language-switcher'

const NAV_ITEMS = [
  { href: '/essence-planner', label: 'nav.essencePlanner', Icon: Disc },
  { href: '/refinement-planner', label: 'nav.refinementPlanner', Icon: Wrench },
  { href: '/growth-planner', label: 'nav.growthPlanner', Icon: ChartNoAxesCombined },
  { href: '/panel-preview', label: 'nav.panelPreview', Icon: PanelsTopLeft },
  { href: '/banner-calendar', label: 'nav.bannerCalendar', Icon: Calendar },
  ...(FEATURES.forum ? [{ href: '/forum', label: 'nav.forum', Icon: MessageCircle }] : []),
]
const TOOL_ITEMS = [
  { href: '/tools/game-i18n', label: 'nav.gameI18nLookup', Icon: Languages },
  { href: 'https://status.canmoe.com/', label: 'nav.siteStatus', Icon: ExternalLink, external: true },
]
const WIKI_ITEMS = [
  { href: '/wiki/characters', label: 'wiki.categories.characters', Icon: UsersRound },
  { href: '/wiki/weapons', label: 'wiki.categories.weapons', Icon: Swords },
  { href: '/wiki/equipment', label: 'wiki.categories.equipment', Icon: Shirt },
]

export function AppSidebar() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations()
  const { isUpdateAvailable, info, localInfo, forceUpgrade, refreshPage } = useVersion()
  const { state, setOpenMobile, isMobile } = useSidebar()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  const username = useAuthStore((s) => s.username)
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionExpired = useAuthStore((s) => s.sessionExpired)
  const announcementTotalUnread = useAnnouncementStore((s) =>
    s.announcements.filter((a) => !s.readIds.includes(a.id)).length
  )
  const announcementImportantUnread = useImportantUnreadCount()
  const hasImportantUnread = announcementImportantUnread > 0

  const refreshBtnRef = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  const updatePopupPos = useCallback(() => {
    if (!refreshBtnRef.current) return
    const rect = refreshBtnRef.current.getBoundingClientRect()
    setPopupPos({ top: rect.top + rect.height / 2, left: rect.right + 10 })
  }, [])

  // Post-rehydration auth check. Runs once on mount after zustand
  // rehydration completes. Only when auth feature is enabled.
  const didHydrateCheck = useRef(false)
  useEffect(() => {
    if (!mounted || didHydrateCheck.current || !FEATURES.auth) return
    didHydrateCheck.current = true
    const s = useAuthStore.getState()
    if (s.accessToken) {
      s.fetchMe()
    } else if (s.username) {
      useAuthStore.setState({ sessionExpired: true })
    }
  }, [mounted])

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
  const versionBuildTimeText = mounted && versionBuildTime ? formatTime(versionBuildTime) : '--:--'

  return (
    <TooltipProvider delay={0}>
      <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="overflow-visible"
              render={<NavLink href={`/${locale}`} loadingLabel={t('app.name')} />}
              tooltip={t('app.name')}
              onClick={() => {
                if (isMobile) setOpenMobile(false)
              }}
            >
              <span className="relative inline-flex shrink-0 overflow-visible">
                <Image src="/icon.png" alt={t('app.name')} width={32} height={32} className="size-8 rounded-lg" unoptimized />
                {announcementTotalUnread > 0 && (
                  <span
                    className={cn(
                      'absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-sidebar',
                      hasImportantUnread ? 'bg-amber-500' : 'bg-develop-blue'
                    )}
                  />
                )}
              </span>
              {/* 应用名与未读徽章必须是兄弟节点: 放在同一个 span 里时,
                  span 没有 min-w-0/truncate 而按钮又是 overflow-visible,
                  长名字(zh-CN)会把徽章一起顶出可视区域。 */}
              <span className="min-w-0 flex-1 truncate font-semibold">{t('app.name')}</span>
              {announcementTotalUnread > 0 && (
                <span
                  className={cn(
                    'shrink-0 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold leading-none group-data-[collapsible=icon]:hidden',
                    hasImportantUnread
                      ? 'bg-amber-500 text-white'
                      : 'bg-develop-blue text-white'
                  )}
                >
                  {announcementTotalUnread > 99 ? '99+' : announcementTotalUnread}
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">{t('nav.groupModules')}</SidebarGroupLabel>
          {isMobile || state !== 'collapsed' ? (
            <SidebarMenu className="grid grid-cols-2 gap-1 px-2">
              {NAV_ITEMS.map(({ href, Icon, label }) => {
                const fullHref = `/${locale}${href}`
                const isActive = pathname.startsWith(fullHref)
                const labelText = t(label)
                return (
                  <SidebarMenuItem key={href} className="list-none">
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={labelText}
                      render={<NavLink href={fullHref} loadingLabel={labelText} />}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false)
                      }}
                      className="h-auto min-h-14 flex-col items-center justify-center gap-1 px-1.5 py-2 text-[11px] leading-tight"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="w-full truncate text-center">{labelText}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          ) : (
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, Icon, label }) => {
                const fullHref = `/${locale}${href}`
                const isActive = pathname.startsWith(fullHref)
                const labelText = t(label)
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={labelText}
                      render={<NavLink href={fullHref} loadingLabel={labelText} />}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false)
                      }}
                    >
                      <Icon />
                      <span>{labelText}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          )}
        </SidebarGroup>
        <SidebarGroup className="pt-0 group-data-[collapsible=icon]:px-2">
          <SidebarMenu className="px-2 group-data-[collapsible=icon]:px-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                variant="outline"
                isActive={pathname.startsWith(`/${locale}/background-preview`)}
                tooltip={t('nav.backgroundPreviewTooltip', { badge: t('backgroundPreview.weeklyUpdatedBadge') })}
                render={<NavLink href={`/${locale}/background-preview`} loadingLabel={t('nav.backgroundPreview')} />}
                onClick={() => {
                  if (isMobile) setOpenMobile(false)
                }}
                className="bg-preview-pink/12 hover:bg-preview-pink/16 shadow-[0px_0px_0px_1px_var(--color-preview-pink)] hover:shadow-[0px_0px_0px_1px_var(--color-preview-pink)] group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:shadow-none! group-data-[collapsible=icon]:hover:bg-sidebar-accent!"
              >
                <ImageDown className="size-4" />
                <span className="min-w-0 flex-1 truncate font-medium group-data-[collapsible=icon]:hidden">{t('nav.backgroundPreview')}</span>
                <span className="rounded-full bg-preview-pink px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white group-data-[collapsible=icon]:hidden">
                  {t('backgroundPreview.weeklyUpdatedBadge')}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {/* Wiki */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">{t('nav.groupWiki')}</SidebarGroupLabel>
          {isMobile || state !== 'collapsed' ? (
            <SidebarMenu className="grid grid-cols-3 gap-1 px-2">
              {WIKI_ITEMS.map(({ href, label, Icon }) => {
                const fullHref = `/${locale}${href}`
                const labelText = t(label)
                return (
                  <SidebarMenuItem key={href} className="list-none">
                    <SidebarMenuButton
                      isActive={pathname.startsWith(fullHref)}
                      tooltip={labelText}
                      render={<NavLink href={fullHref} loadingLabel={labelText} />}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false)
                      }}
                      className="h-auto min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-tight"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="w-full truncate text-center">{labelText}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          ) : (
            <SidebarMenu>
              {WIKI_ITEMS.map(({ href, label, Icon }) => {
                const fullHref = `/${locale}${href}`
                const labelText = t(label)
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(fullHref)}
                      tooltip={labelText}
                      render={<NavLink href={fullHref} loadingLabel={labelText} />}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false)
                      }}
                    >
                      <Icon />
                      <span>{labelText}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          )}
        </SidebarGroup>
        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">{t('nav.groupTools')}</SidebarGroupLabel>
          <SidebarMenu>
            {TOOL_ITEMS.map(({ href, label, Icon, external }) => {
              const fullHref = external ? href : `/${locale}${href}`
              const labelText = t(label)
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={!external && pathname.startsWith(fullHref)}
                    tooltip={labelText}
                    render={external
                      ? <a href={href} target="_blank" rel="noopener noreferrer" />
                      : <NavLink href={fullHref} loadingLabel={labelText} />
                    }
                    onClick={() => {
                      if (isMobile) setOpenMobile(false)
                    }}
                  >
                    <Icon />
                    <span>{labelText}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
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
                    transition: 'top 0.3s ease, left 0.3s ease',
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
            <LanguageSwitcher />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<NavLink href={`/${locale}/update`} loadingLabel={t('nav.update')} />}
              tooltip={t('nav.update')}
              onClick={() => { if (isMobile) setOpenMobile(false) }}
            >
              <Download />
              {versionStr ? (
                <span className="text-[11px] leading-tight">
                  <span>{t('version.compatibleVersion')}: {versionMajorMinor}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {versionBuildTimeText} | {versionStr}
                  </span>
                </span>
              ) : (
                <span>{t('nav.update')}</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<NavLink href={`/${locale}/settings`} loadingLabel={t('nav.settings')} />}
              onClick={() => { if (isMobile) setOpenMobile(false) }}
            >
              <Settings />
              <span>{t('nav.settings')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<NavLink href={`/${locale}/about`} loadingLabel={t('nav.about')} />}
              onClick={() => { if (isMobile) setOpenMobile(false) }}
            >
              <Info />
              <span>{t('nav.about')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!mounted ? null : !FEATURES.auth ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<NavLink href={`/${locale}/login`} loadingLabel={t('nav.login')} />}
                tooltip={t('nav.login')}
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              >
                <LogIn className="size-4" />
                <span>{t('nav.login')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : accessToken ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<NavLink href={`/${locale}/account`} loadingLabel={username || t('account.title')} />}
                  tooltip={t('account.title')}
                  onClick={() => { if (isMobile) setOpenMobile(false) }}
                >
                  <CircleUser className="size-4" />
                  <span>{username || t('account.title')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : sessionExpired ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<NavLink href={`/${locale}/login?expired=1`} loadingLabel={t('account.sessionExpired')} />}
                tooltip={t('account.sessionExpired')}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              >
                <AlertTriangle className="size-4" />
                <span>{t('account.sessionExpired')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<NavLink href={`/${locale}/login`} loadingLabel={t('nav.login')} />}
                tooltip={t('nav.login')}
                onClick={() => { if (isMobile) setOpenMobile(false) }}
              >
                <LogIn className="size-4" />
                <span>{t('nav.login')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
        {forceUpgrade && <ForceUpgradeDialog />}
      </Sidebar>
    </TooltipProvider>
  )
}
