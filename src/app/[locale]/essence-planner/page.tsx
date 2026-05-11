'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { WeaponGrid } from '@/components/essence/weapon-grid'
import { DungeonCard } from '@/components/essence/dungeon-card'
import { EssenceSettingsDialog } from '@/components/essence/essence-settings-dialog'
import { CustomWeaponDialog } from '@/components/essence/custom-weapon-dialog'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { getRegion } from '@/data/dungeons'
import { Plus } from 'lucide-react'

export default function EssencePlannerPage() {
  const t = useTranslations()
  const [customWeaponOpen, setCustomWeaponOpen] = useState(false)
  const selectedWeaponIds = useMatrixStore((s) => s.selectedWeaponIds)
  const plansMap = useMatrixStore((s) => s.plansMap)
  const planOrder = useMatrixStore((s) => s.planOrder)
  const plansStale = useMatrixStore((s) => s.plansStale)
  const expandedPlanKeys = useMatrixStore((s) => s.expandedPlanKeys)
  const selectAllWeapons = useMatrixStore((s) => s.selectAllWeapons)
  const clearWeapons = useMatrixStore((s) => s.clearWeapons)

  // Priority settings (from essence settings store)
  const regionFirst = useEssenceSettingsStore((s) => s.regionFirst)
  const regionSecond = useEssenceSettingsStore((s) => s.regionSecond)
  const weaponPriority = useEssenceSettingsStore((s) => s.weaponPriority)
  const weaponOwnership = useEssenceSettingsStore((s) => s.weaponOwnership)

  const selectedCount = selectedWeaponIds.length
  const noWeaponsSelected = selectedCount === 0

  const expandedSet = useMemo(
    () => new Set(expandedPlanKeys),
    [expandedPlanKeys]
  )

  // Apply region / weapon priority sorting
  const sortedPlanOrder = useMemo(() => {
    const order = planOrder.filter((key) => Boolean(plansMap[key]))

    // Build region lookup: dungeon -> region
    const planRegions = new Map<string, string>()
    for (const key of order) {
      const plan = plansMap[key]
      if (plan) {
        planRegions.set(key, getRegion(plan.dungeon))
      }
    }

    // Compute ownership stats per plan (for weapon priority)
    const planUnownedCount = new Map<string, number>()
    const planOwnedCount = new Map<string, number>()
    if (weaponPriority !== 'none') {
      for (const key of order) {
        const plan = plansMap[key]
        if (!plan) continue
        let unowned = 0
        let owned = 0
        for (const { weapon, isSelected } of plan.matchedWeapons) {
          if (!isSelected) continue
          if (weaponOwnership[weapon.id]) {
            owned++
          } else {
            unowned++
          }
        }
        planUnownedCount.set(key, unowned)
        planOwnedCount.set(key, owned)
      }
    }

    order.sort((a, b) => {
      const planA = plansMap[a]
      const planB = plansMap[b]
      if (!planA || !planB) return 0

      // 1. Region priority (two-level)
      if (regionFirst) {
        const regionA = planRegions.get(a) ?? ''
        const regionB = planRegions.get(b) ?? ''
        const rankA = regionA === regionFirst ? 0 : regionA === regionSecond ? 1 : 2
        const rankB = regionB === regionFirst ? 0 : regionB === regionSecond ? 1 : 2
        if (rankA !== rankB) return rankA - rankB
      }

      // 2. Weapon ownership priority
      if (weaponPriority === 'unowned-first') {
        const diff = (planUnownedCount.get(b) ?? 0) - (planUnownedCount.get(a) ?? 0)
        if (diff !== 0) return diff
      } else if (weaponPriority === 'owned-first') {
        const diff = (planOwnedCount.get(b) ?? 0) - (planOwnedCount.get(a) ?? 0)
        if (diff !== 0) return diff
      }

      // 3. Selected count desc → 4. Total count desc
      const selDiff = planB.selectedCount - planA.selectedCount
      if (selDiff !== 0) return selDiff
      return planB.totalCount - planA.totalCount
    })

    return order
  }, [planOrder, plansMap, regionFirst, regionSecond, weaponPriority, weaponOwnership])

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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCustomWeaponOpen(true)}
          aria-label={t('essence.customWeapons')}
        >
          <Plus className="size-4" />
        </Button>
        <EssenceSettingsDialog />
        <CustomWeaponDialog
          open={customWeaponOpen}
          onOpenChange={setCustomWeaponOpen}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: weapon grid */}
        <div className="w-80 shrink-0 border-r border-border overflow-y-scroll p-3">
          <WeaponGrid />
        </div>

        {/* Right: plans */}
        <div className="flex-1 overflow-y-auto p-4">
          {noWeaponsSelected ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t('essence.emptyHint')}
            </div>
          ) : sortedPlanOrder.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {plansStale ? t('essence.computing') : t('essence.noPlanMatch')}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedPlanOrder.map((planKey) => {
                const plan = plansMap[planKey]
                if (!plan) return null
                return (
                  <DungeonCard
                    key={planKey}
                    plan={plan}
                    isExpanded={expandedSet.has(planKey)}
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
