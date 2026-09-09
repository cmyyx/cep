'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { EquipList } from '@/components/refinement/equip-list'
import { RefinementPanel } from '@/components/refinement/refinement-panel'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { StructuredData } from '@/components/shared/structured-data'
import { useSiteUrl } from '@/hooks/use-site-url'

type MobileView = 'equips' | 'recommend'

export default function RefinementPlannerPage() {
  const t = useTranslations()
  const pathname = usePathname()
  const siteUrl = useSiteUrl()
  const [mobileView, setMobileView] = useState<MobileView>('equips')
  const [viewEquipOpen, setViewEquipOpen] = useState(false)

  const selectedEquipId = useRefinementStore((s) => s.selectedEquipId)
  const hasSelection = selectedEquipId !== null

  return (
    <>
      <StructuredData
        type="WebApplication"
        name={`${t('app.name')} - ${t('nav.refinementPlanner')}`}
        description={t('meta.refinementPlannerDescription')}
        url={`${siteUrl}${pathname}`}
      />
      <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
          <SidebarTrigger />
          <h1 className="text-base font-semibold tracking-tight">
            {t('nav.refinementPlanner')}
          </h1>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground hidden md:inline">
            {t('app.name')}
          </span>
        </div>

      {/* Desktop layout: left equip list + right recommendations */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-1/2 shrink-0 border-r border-border overflow-y-scroll p-3 pb-16">
          <EquipList />
        </div>
        <div className="flex-1 overflow-y-scroll p-4 pb-16">
          <RefinementPanel />
        </div>
      </div>

      {/* Mobile layout: segmented control + single panel + bottom bar.
          内容由布局滚动壳滚动；分段控件 sticky 钉在滚动壳顶部。 */}
      <div className="flex md:hidden flex-col">
        {/* Segmented control — sticky 钉在滚动壳顶；z-40 盖过装备卡角标的 z-30 */}
        <div className="sticky top-0 z-40 mx-4 mt-3 flex shrink-0 rounded-lg bg-muted p-0.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMobileView('equips')}
            className={cn(
              'flex-1 px-4 py-1.5 h-auto rounded-md text-sm font-medium transition-colors',
              mobileView === 'equips'
                ? 'bg-background text-foreground shadow-[var(--shadow-raised)]'
                : 'text-muted-foreground',
            )}
          >
            {t('refinement.equipsTab')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMobileView('recommend')}
            disabled={!hasSelection}
            className={cn(
              'flex-1 px-4 py-1.5 h-auto rounded-md text-sm font-medium transition-colors',
              mobileView === 'recommend'
                ? 'bg-background text-foreground shadow-[var(--shadow-raised)]'
                : 'text-muted-foreground',
              !hasSelection && 'opacity-50',
            )}
          >
            {t('refinement.recommendTab')}
          </Button>
        </div>

        {/* Content area — mobile 由布局滚动壳滚动 */}
        <div className="pb-24">
          {mobileView === 'equips' ? (
            <div className="p-3">
              <EquipList />
            </div>
          ) : (
            <div className="p-4">
              {/* Selected equip context header */}
              {hasSelection && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewEquipOpen(true)}
                  className="mb-3 h-auto gap-2 px-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>{t('refinement.viewSelectedEquip')}</span>
                </Button>
              )}
              <RefinementPanel />
            </div>
          )}
        </div>

        {/* Bottom bar — fixed so it stays reachable while the layout shell scrolls.
            Parent is md:hidden, desktop unaffected. */}
        <div className="fixed inset-x-0 bottom-0 safe-area-bottom-bar z-40 flex items-center justify-between bg-background px-4 py-2.5 shadow-[var(--shadow-border-inset-t)]">
          <span className="text-sm text-muted-foreground">
            {hasSelection
              ? t('refinement.hasSelection')
              : t('refinement.noSelection')}
          </span>
          {mobileView === 'equips' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => setMobileView('recommend')}
              disabled={!hasSelection}
            >
              {t('refinement.viewRecommend')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileView('equips')}
            >
              {t('refinement.manageEquips')}
            </Button>
          )}
        </div>
      </div>

      {/* View selected equip bottom sheet */}
      <Sheet open={viewEquipOpen} onOpenChange={setViewEquipOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('refinement.selectedEquip')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <RefinementPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </>
  )
}
