'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { CharacterPanelConfig } from '@/components/panel-preview/character-panel-config'
import { EquipmentWeaponConfig } from '@/components/panel-preview/equipment-weapon-config'
import { PanelStatsSummary } from '@/components/panel-preview/panel-stats-summary'
import { usePanelPreviewStore } from '@/stores/usePanelPreviewStore'
import { cn } from '@/lib/utils'

type MobileView = 'configuration' | 'stats'

export default function PanelPreviewPage() {
  const t = useTranslations('panelPreview')
  const config = usePanelPreviewStore((state) => state.config)
  const reset = usePanelPreviewStore((state) => state.reset)
  const [mobileView, setMobileView] = useState<MobileView>('configuration')
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.08)]"><SidebarTrigger /><h1 className="min-w-0 truncate text-base font-semibold tracking-tight">{t('title')}</h1><div className="flex-1" /><Button variant="ghost" size="sm" disabled={!config} onClick={reset}><RotateCcw />{t('reset')}</Button></header>
      <div className="hidden min-h-0 flex-1 overflow-hidden xl:grid xl:grid-cols-[minmax(34rem,1.35fr)_minmax(22rem,0.65fr)]">
        <section className="min-h-0 space-y-6 overflow-y-auto p-4 pb-16 shadow-[1px_0px_0px_0px_rgba(0,0,0,0.08)]"><CharacterPanelConfig /><EquipmentWeaponConfig /></section>
        <aside className="min-h-0 overflow-y-auto p-4 pb-16"><PanelStatsSummary /></aside>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:hidden">
        <div className="mx-4 mt-3 flex shrink-0 rounded-lg bg-muted p-0.5">
          <Button type="button" variant="ghost" onClick={() => setMobileView('configuration')} className={cn('h-auto flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mobileView === 'configuration' ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted-foreground')}>{t('configurationTab')}</Button>
          <Button type="button" variant="ghost" onClick={() => setMobileView('stats')} className={cn('h-auto flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mobileView === 'stats' ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted-foreground')}>{t('statsTab')}</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {mobileView === 'configuration' ? <section className="space-y-6 p-4 pb-16"><CharacterPanelConfig /><EquipmentWeaponConfig /></section> : <aside className="p-4 pb-16"><PanelStatsSummary /></aside>}
        </div>
        <div className="safe-area-mb relative z-40 flex shrink-0 justify-end bg-background px-4 py-2.5 shadow-[inset_0px_1px_0px_0px_rgba(0,0,0,0.08)]">
          <Button type="button" variant={mobileView === 'configuration' ? 'default' : 'outline'} size="sm" onClick={() => setMobileView(mobileView === 'configuration' ? 'stats' : 'configuration')} disabled={mobileView === 'configuration' && !config}>{mobileView === 'configuration' ? t('viewStats') : t('editConfiguration')}</Button>
        </div>
      </div>
    </div>
  )
}
