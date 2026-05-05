'use client'

import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { WeaponGrid } from '@/components/essence/weapon-grid'
import { DungeonCard } from '@/components/essence/dungeon-card'
import { useMatrixStore } from '@/stores/useMatrixStore'

export default function EssencePlannerPage() {
  const t = useTranslations()
  const {
    selectedWeaponIds,
    dungeonPlans,
    expandedDungeonIds,
    toggleDungeonExpand,
    selectAllWeapons,
    clearWeapons,
  } = useMatrixStore()

  const selectedCount = selectedWeaponIds.size

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {t('nav.essencePlanner')}
        </h1>
        <span className="text-xs text-muted-foreground">
          已选 {selectedCount} 把
        </span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={selectAllWeapons}>全选</Button>
        <Button variant="ghost" size="sm" onClick={clearWeapons}>清空</Button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: weapon grid */}
        <div className="w-80 shrink-0 border-r border-border overflow-y-auto p-3">
          <WeaponGrid />
        </div>

        {/* Right: plans */}
        <div className="flex-1 overflow-y-auto p-4">
          {dungeonPlans.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              选择武器以查看推荐方案（将展示所有可刷武器，已选优先）
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dungeonPlans.map((plan) => {
                const planKey = `${plan.dungeon.id}-${plan.lockType}-${plan.lockValue}`
                return (
                  <DungeonCard
                    key={planKey}
                    plan={plan}
                    isExpanded={expandedDungeonIds.has(plan.dungeon.id)}
                    onToggleExpand={() => toggleDungeonExpand(plan.dungeon.id)}
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
