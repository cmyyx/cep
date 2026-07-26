'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { usePlannerData } from '@/lib/planner/planner-data-loader'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataLoadError } from '@/components/shared/data-load-error'
import { RarityFrame } from '@/components/shared/rarity-frame'
import { GrowthEntityPicker } from '@/components/growth-planner/growth-entity-picker'
import { GrowthTargetCard } from '@/components/growth-planner/growth-target-card'
import { GrowthSummary } from '@/components/growth-planner/growth-summary'
import { useGrowthPlannerStore } from '@/stores/useGrowthPlannerStore'
import { useWikiTranslations } from '@/hooks/use-wiki-translations'
import { cn } from '@/lib/utils'

type MobileView = 'selection' | 'summary'

export default function GrowthPlannerPage() {
  const t = useTranslations('growthPlanner')
  const { entityName, ready: wikiTextReady } = useWikiTranslations()
  const { data: plannerData, error: plannerError, retry: retryPlannerData } = usePlannerData()
  const configs = useGrowthPlannerStore((state) => state.configs)
  const clear = useGrowthPlannerStore((state) => state.clear)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('selection')
  const resolvedActiveId = activeId && configs.some((config) => config.id === activeId) ? activeId : configs[0]?.id ?? null
  const activeConfig = configs.find((config) => config.id === resolvedActiveId)
  const handleEntityAdded = (id: string) => {
    setActiveId(id)
    setConfigOpen(true)
  }

  const renderHeader = (clearDisabled: boolean) => (
    <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
      <SidebarTrigger />
      <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{t('title')}</h1>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" disabled={clearDisabled} onClick={() => setClearConfirmOpen(true)}><RotateCcw />{t('clear')}</Button>
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

  // Two independent async chunks feed this page: the planner dataset
  // (usePlannerData) and the per-locale game-text catalog (useWikiTranslations).
  // Gate on both, otherwise whichever arrives first decides whether the user
  // sees raw ids like `chr_9000_endmin` and searches only match ids.
  if (!plannerData || !wikiTextReady) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderHeader(true)}
        <div className="h-[5.5rem] shrink-0 px-4 py-3 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex h-16 items-center gap-2">
            <Skeleton className="size-12 rounded-md" />
            <Skeleton className="size-12 rounded-md" />
            <Skeleton className="size-12 rounded-md" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
          </div>
          <div className="hidden min-h-0 flex-col gap-3 lg:flex">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="min-h-0 w-full flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }
  const { wikiCharacters, wikiWeapons } = plannerData

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {renderHeader(configs.length === 0)}
      <div className="h-[5.5rem] shrink-0 overflow-x-auto px-4 py-3 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="flex h-16 min-w-max items-center gap-2">
          {configs.length === 0 ? <span className="text-sm text-muted-foreground">{t('targetStripEmpty')}</span> : configs.map((config) => {
            const summary = config.kind === 'character' ? wikiCharacters.find((entry) => entry.id === config.id) : wikiWeapons.find((entry) => entry.id === config.id)
            if (!summary) return null
            const name = entityName(summary)
            return (
              <Button key={config.id} type="button" variant={config.id === resolvedActiveId ? 'secondary' : 'ghost'} size="card" onClick={() => { setActiveId(config.id); setConfigOpen(true) }} className="flex h-16 items-center gap-2 rounded-lg px-2 pr-3">
                <RarityFrame imageSrc={`${config.kind === 'character' ? '/images/characters' : '/images/weapon'}/${summary.imageId}.avif`} backgroundSrc={config.kind === 'character' ? '/images/character-frame-bg.png' : undefined} title={name} rarity={summary.rarity} showTitle={false} imageClassName={config.kind === 'weapon' ? 'object-contain p-1' : 'object-cover'} className="size-12 rounded-md shadow-none" />
                <span className="max-w-28 truncate text-xs">{name}</span>
              </Button>
            )
          })}
        </div>
      </div>
      <div className="hidden min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)]">
        <main className="min-h-0 overflow-y-scroll p-4 pb-16 shadow-[1px_0px_0px_0px_rgba(0,0,0,0.08)]">
          <GrowthSummary />
        </main>
        <aside className="flex min-h-0 min-w-0 flex-col p-4"><GrowthEntityPicker onEntityAdded={handleEntityAdded} /></aside>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        <div className="mx-4 mt-3 flex shrink-0 rounded-lg bg-muted p-0.5">
          <Button type="button" variant="ghost" aria-pressed={mobileView === 'selection'} onClick={() => setMobileView('selection')} className={cn('h-auto flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mobileView === 'selection' ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted-foreground')}>{t('selectionTab')}</Button>
          <Button type="button" variant="ghost" aria-pressed={mobileView === 'summary'} onClick={() => setMobileView('summary')} className={cn('h-auto flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mobileView === 'summary' ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted-foreground')}>{t('summaryTab')}</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {mobileView === 'selection' ? <div className="flex h-full min-h-0 flex-col p-3"><GrowthEntityPicker onEntityAdded={handleEntityAdded} /></div> : <div className="h-full overflow-y-auto p-4"><GrowthSummary /></div>}
        </div>
        <div className="safe-area-mb relative z-40 flex shrink-0 items-center justify-between bg-background px-4 py-2.5 shadow-[inset_0px_1px_0px_0px_rgba(0,0,0,0.08)]">
          <span className="text-sm text-muted-foreground">{t('selectedCount', { count: configs.length })}</span>
          <Button type="button" variant={mobileView === 'selection' ? 'default' : 'outline'} size="sm" onClick={() => setMobileView(mobileView === 'selection' ? 'summary' : 'selection')} disabled={mobileView === 'selection' && configs.length === 0}>{mobileView === 'selection' ? t('viewSummary') : t('manageTargets')}</Button>
        </div>
      </div>
      <Dialog open={configOpen && Boolean(activeConfig)} onOpenChange={setConfigOpen}>
        <DialogContent className="h-[min(90svh,58rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[min(94vw,90rem)]">
          <div className="pr-8"><DialogTitle>{t('targetConfiguration')}</DialogTitle><DialogDescription className="mt-1">{t('targetConfigurationDescription')}</DialogDescription></div>
          <div className="min-h-0 overflow-y-auto pr-1">{activeConfig ? <GrowthTargetCard config={activeConfig} onRemove={() => setConfigOpen(false)} /> : null}</div>
          <DialogFooter><Button type="button" onClick={() => setConfigOpen(false)}>{t('save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Clearing every target is destructive enough to confirm — it drops the
          whole selection in one click, even though the configs stay recoverable
          in the store's restore cache. */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t('clear')}</DialogTitle>
            <DialogDescription>{t('selectedCount', { count: configs.length })}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setClearConfirmOpen(false)}>{t('cancel')}</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => { clear(); setClearConfirmOpen(false) }}>{t('clear')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
