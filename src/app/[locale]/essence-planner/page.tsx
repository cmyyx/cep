'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { WeaponGrid } from '@/components/essence/weapon-grid'
import { WeaponCard } from '@/components/essence/weapon-card'
import { DungeonCard } from '@/components/essence/dungeon-card'
import { EssenceSettingsDialog } from '@/components/essence/essence-settings-dialog'
import { CustomWeaponDialog } from '@/components/essence/custom-weapon-dialog'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { getRegion } from '@/data/dungeons'
import { weapons as staticWeapons } from '@/data/weapons'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { Weapon } from '@/types/matrix'

type MobileView = 'weapons' | 'plans'

export default function EssencePlannerPage() {
  const t = useTranslations()
  const [customWeaponOpen, setCustomWeaponOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('weapons')
  const [viewAllOpen, setViewAllOpen] = useState(false)

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
  const customWeapons = useEssenceSettingsStore((s) => s.customWeapons)

  const selectedCount = selectedWeaponIds.length
  const noWeaponsSelected = selectedCount === 0

  const selectedSet = useMemo(
    () => new Set(selectedWeaponIds),
    [selectedWeaponIds],
  )

  // Combined weapon map for "View All" sheet (static + custom)
  const allWeaponsMap = useMemo(() => {
    const map = new Map<string, Weapon>()
    for (const w of staticWeapons) map.set(w.id, w)
    for (const w of customWeapons) map.set(w.id, w)
    return map
  }, [customWeapons])

  const expandedSet = useMemo(
    () => new Set(expandedPlanKeys),
    [expandedPlanKeys],
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

  const renderPlanList = () => {
    if (noWeaponsSelected) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          {t('essence.emptyHint')}
        </div>
      )
    }
    if (sortedPlanOrder.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          {plansStale ? t('essence.computing') : t('essence.noPlanMatch')}
        </div>
      )
    }
    return (
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
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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

      {/* Desktop layout: left weapon grid + right plans */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-96 shrink-0 border-r border-border overflow-y-scroll p-3">
          <WeaponGrid />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {renderPlanList()}
        </div>
      </div>

      {/* Mobile layout: segmented control + single panel + bottom bar */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Segmented control */}
        <div className="flex mx-4 mt-3 rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setMobileView('weapons')}
            className={cn(
              'flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              mobileView === 'weapons'
                ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-muted-foreground',
            )}
          >
            {t('essence.weaponsTab')}
          </button>
          <button
            type="button"
            onClick={() => setMobileView('plans')}
            className={cn(
              'flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              mobileView === 'plans'
                ? 'bg-background text-foreground shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-muted-foreground',
            )}
          >
            {t('essence.plansTab')}
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {mobileView === 'weapons' ? (
            <div className="p-3">
              <WeaponGrid initialFilterCollapsed />
            </div>
          ) : (
            <div className="p-4">
              {/* Selected weapons context header */}
              {!noWeaponsSelected && (
                <button
                  type="button"
                  onClick={() => setViewAllOpen(true)}
                  className="flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{t('essence.selectedCount', { count: selectedCount })}</span>
                  <span className="text-xs">{t('essence.viewAllSelected')}</span>
                </button>
              )}
              {renderPlanList()}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-background">
          <span className="text-sm text-muted-foreground">
            {t('essence.selectedCount', { count: selectedCount })}
          </span>
          {mobileView === 'weapons' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => setMobileView('plans')}
              disabled={noWeaponsSelected}
            >
              {t('essence.viewPlans')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileView('weapons')}
            >
              {t('essence.manageWeapons')}
            </Button>
          )}
        </div>
      </div>

      {/* "View All" selected weapons bottom sheet */}
      <Sheet open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('essence.selectedCount', { count: selectedCount })}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            {selectedWeaponIds.map((id) => {
              const weapon = allWeaponsMap.get(id)
              if (!weapon) return null
              return (
                <WeaponCard
                  key={id}
                  weapon={weapon}
                  isSelected={selectedSet.has(id)}
                />
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
