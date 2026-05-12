'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { EquipList } from '@/components/refinement/equip-list'
import { RefinementPanel } from '@/components/refinement/refinement-panel'
import { useRefinementStore } from '@/stores/useRefinementStore'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type MobileView = 'equips' | 'recommend'

export default function RefinementPlannerPage() {
  const t = useTranslations()
  const [mobileView, setMobileView] = useState<MobileView>('equips')
  const [viewEquipOpen, setViewEquipOpen] = useState(false)

  const selectedEquipId = useRefinementStore((s) => s.selectedEquipId)
  const hasSelection = selectedEquipId !== null

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
        <div className="w-1/2 shrink-0 border-r border-border overflow-y-scroll p-3">
          <EquipList />
        </div>
        <div className="flex-1 overflow-y-scroll p-4">
          <RefinementPanel />
        </div>
      </div>

      {/* Mobile layout: segmented control + single panel + bottom bar */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Segmented control */}
        <div className="flex mx-4 mt-3 rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setMobileView('equips')}
            className={cn(
              'flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              mobileView === 'equips'
                ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-muted-foreground',
            )}
          >
            {t('refinement.equipsTab')}
          </button>
          <button
            type="button"
            onClick={() => setMobileView('recommend')}
            disabled={!hasSelection}
            className={cn(
              'flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              mobileView === 'recommend'
                ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-muted-foreground',
              !hasSelection && 'opacity-50',
            )}
          >
            {t('refinement.recommendTab')}
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {mobileView === 'equips' ? (
            <div className="p-3">
              <EquipList />
            </div>
          ) : (
            <div className="p-4">
              {/* Selected equip context header */}
              {hasSelection && (
                <button
                  type="button"
                  onClick={() => setViewEquipOpen(true)}
                  className="flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{t('refinement.viewSelectedEquip')}</span>
                </button>
              )}
              <RefinementPanel />
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-background">
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
  )
}
