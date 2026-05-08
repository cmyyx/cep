'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { WeaponGrid } from '@/components/essence/weapon-grid'
import { DungeonCard } from '@/components/essence/dungeon-card'
import { useMatrixStore } from '@/stores/useMatrixStore'

export default function EssencePlannerPage() {
  const t = useTranslations()
  const selectedWeaponIds = useMatrixStore((s) => s.selectedWeaponIds)
  const plansMap = useMatrixStore((s) => s.plansMap)
  const planOrder = useMatrixStore((s) => s.planOrder)
  const plansStale = useMatrixStore((s) => s.plansStale)
  const expandedDungeonIds = useMatrixStore((s) => s.expandedDungeonIds)
  const selectAllWeapons = useMatrixStore((s) => s.selectAllWeapons)
  const clearWeapons = useMatrixStore((s) => s.clearWeapons)

  const selectedCount = selectedWeaponIds.length
  const noWeaponsSelected = selectedCount === 0

  const expandedSet = useMemo(
    () => new Set(expandedDungeonIds),
    [expandedDungeonIds]
  )

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('nav.essencePlanner')}
        </h1>
        <span className="text-xs text-muted-foreground">
          {t('essence.selectedCount', { count: selectedCount })}
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={selectAllWeapons}>
          {t('essence.selectAll')}
        </Button>
        <Button variant="ghost" size="sm" onClick={clearWeapons}>
          {t('essence.clearAll')}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: weapon grid */}
        <div className="w-80 shrink-0 border-r border-border overflow-y-auto p-3">
          <WeaponGrid />
        </div>

        {/* Right: plans */}
        <div className="flex-1 overflow-y-auto p-4">
          {noWeaponsSelected ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t('essence.emptyHint')}
            </div>
          ) : planOrder.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {plansStale ? t('essence.computing') : t('essence.noPlanMatch')}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {planOrder.map((planKey) => {
                const plan = plansMap[planKey]
                if (!plan) return null
                return (
                  <DungeonCard
                    key={planKey}
                    plan={plan}
                    isExpanded={expandedSet.has(plan.dungeon.id)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
