'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataLoadError } from '@/components/shared/data-load-error'
import { usePlannerData } from '@/lib/planner/planner-data-loader'
import { CharacterPanelConfig } from '@/components/panel-preview/character-panel-config'
import { EquipmentWeaponConfig } from '@/components/panel-preview/equipment-weapon-config'
import { PanelStatsSummary } from '@/components/panel-preview/panel-stats-summary'
import { usePanelPreviewStore } from '@/stores/usePanelPreviewStore'

type MobileView = 'configuration' | 'stats'

export default function PanelPreviewPage() {
  const t = useTranslations('panelPreview')
  const { data: plannerData, error: plannerError, retry: retryPlannerData } = usePlannerData()
  const config = usePanelPreviewStore((state) => state.config)
  const reset = usePanelPreviewStore((state) => state.reset)
  const [mobileView, setMobileView] = useState<MobileView>('configuration')
  // 80rem, not 1280px: the desktop grid below is gated on Tailwind's `xl:`
  // breakpoint, which is rem-based. A px query disagrees with it whenever the
  // browser root font size is not 16px, leaving both panels stacked inside an
  // overflow-hidden container with no scrollbar.
  const isDesktop = useMediaQuery('(min-width: 80rem)')

  const renderHeader = (resetDisabled: boolean) => (
    <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[var(--shadow-border-b)]">
      <SidebarTrigger />
      <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{t('title')}</h1>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" disabled={resetDisabled} onClick={reset}><RotateCcw />{t('reset')}</Button>
    </header>
  )

  // A failed chunk import (deploy-stale hash, offline) previously left the page
  // stuck on skeletons forever; offer an explicit retry instead.
  if (plannerError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderHeader(true)}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DataLoadError onRetry={retryPlannerData} />
        </div>
      </div>
    )
  }

  // Gate on the shared planner data chunk: descendants read it synchronously
  // via getPlannerGameData()/getWikiWeaponSummaries() once this resolves.
  if (!plannerData) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderHeader(true)}
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(34rem,1.35fr)_minmax(22rem,0.65fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
          </div>
          <div className="hidden min-h-0 flex-col gap-3 xl:flex">
            <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {renderHeader(!config)}
      {isDesktop ? (
        <div className="min-h-0 flex-1 overflow-hidden xl:grid xl:grid-cols-[minmax(34rem,1.35fr)_minmax(22rem,0.65fr)]">
          <section className="min-h-0 space-y-6 overflow-y-auto p-4 pb-16 shadow-[var(--shadow-border-r)]"><CharacterPanelConfig /><EquipmentWeaponConfig /></section>
          <aside className="min-h-0 overflow-y-auto p-4 pb-16"><PanelStatsSummary /></aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-4 mt-3 flex shrink-0 rounded-lg bg-muted p-0.5">
            <Button type="button" variant="ghost" aria-pressed={mobileView === 'configuration'} onClick={() => setMobileView('configuration')} className={cn('h-auto flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mobileView === 'configuration' ? 'bg-background text-foreground shadow-[var(--shadow-raised)]' : 'text-muted-foreground')}>{t('configurationTab')}</Button>
            <Button type="button" variant="ghost" aria-pressed={mobileView === 'stats'} onClick={() => setMobileView('stats')} className={cn('h-auto flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mobileView === 'stats' ? 'bg-background text-foreground shadow-[var(--shadow-raised)]' : 'text-muted-foreground')}>{t('statsTab')}</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {mobileView === 'configuration' ? <section className="space-y-6 p-4 pb-16"><CharacterPanelConfig /><EquipmentWeaponConfig /></section> : <aside className="p-4 pb-16"><PanelStatsSummary /></aside>}
          </div>
          <div className="safe-area-mb relative z-40 flex shrink-0 justify-end bg-background px-4 py-2.5 shadow-[var(--shadow-border-inset-t)]">
            <Button type="button" variant={mobileView === 'configuration' ? 'default' : 'outline'} size="sm" onClick={() => setMobileView(mobileView === 'configuration' ? 'stats' : 'configuration')} disabled={mobileView === 'configuration' && !config}>{mobileView === 'configuration' ? t('viewStats') : t('editConfiguration')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
