'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
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
import { getRegion, getSubRegion, getRegions, getSubRegions } from '@/data/dungeons'
import { dungeons } from '@/data/dungeons'
import { weapons as staticWeapons } from '@/data/weapons'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
type MobileView = 'weapons' | 'plans'

export default function EssencePlannerPage() {
  const t = useTranslations()
  const [customWeaponOpen, setCustomWeaponOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('weapons')
  const [viewAllOpen, setViewAllOpen] = useState(false)

  // Dynamic region data from dungeon list
  const regions = useMemo(() => getRegions(dungeons), [])
  const subRegionsByRegion = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of regions) {
      map.set(r, getSubRegions(dungeons, r))
    }
    return map
  }, [regions])

  // Matrix store
  const selectedWeaponIds = useMatrixStore((s) => s.selectedWeaponIds)
  const plansMap = useMatrixStore((s) => s.plansMap)
  const planOrder = useMatrixStore((s) => s.planOrder)
  const plansStale = useMatrixStore((s) => s.plansStale)
  const expandedPlanKeys = useMatrixStore((s) => s.expandedPlanKeys)
  const selectAllWeapons = useMatrixStore((s) => s.selectAllWeapons)
  const clearWeapons = useMatrixStore((s) => s.clearWeapons)
  const storeSelectedRegions = useMatrixStore((s) => s.selectedRegions)
  const storeSelectedSubRegions = useMatrixStore((s) => s.selectedSubRegions)
  const setSelectedRegions = useMatrixStore((s) => s.setSelectedRegions)
  const setSelectedSubRegions = useMatrixStore((s) => s.setSelectedSubRegions)

  // Convert store arrays to Sets for filter logic
  const selectedRegions = useMemo(() => new Set(storeSelectedRegions), [storeSelectedRegions])
  const selectedSubRegions = useMemo(() => new Set(storeSelectedSubRegions), [storeSelectedSubRegions])

  // Settings store
  const regionFirst = useEssenceSettingsStore((s) => s.regionFirst)
  const regionSecond = useEssenceSettingsStore((s) => s.regionSecond)
  const customWeapons = useEssenceSettingsStore((s) => s.customWeapons)
  // Hide settings (for sorting by visible selected count)
  const hideFourStarPlans = useEssenceSettingsStore((s) => s.hideFourStarWeaponsPlans)
  const hideUnownedPlans = useEssenceSettingsStore((s) => s.hideUnownedWeaponsPlans)
  const hideEssenceOwnedPlans = useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsPlans)
  const onlyBothOwned = useEssenceSettingsStore((s) => s.onlyHideWhenBothOwned)
  const weaponOwnership = useEssenceSettingsStore((s) => s.weaponOwnership)
  const essenceStatus = useEssenceSettingsStore((s) => s.essenceStatus)

  const selectedCount = selectedWeaponIds.length
  const noWeaponsSelected = selectedCount === 0

  const selectedSet = useMemo(
    () => new Set(selectedWeaponIds),
    [selectedWeaponIds],
  )

  // Combined weapon map for "View All" sheet (static + custom)
  const allWeaponsMap = useMemo(() => {
    const map = new Map<string, import('@/types/matrix').Weapon>()
    for (const w of staticWeapons) map.set(w.id, w)
    for (const w of customWeapons) map.set(w.id, w)
    return map
  }, [customWeapons])

  const expandedSet = useMemo(
    () => new Set(expandedPlanKeys),
    [expandedPlanKeys],
  )

  // Helper: count visible selected weapons in a plan (respecting hide settings)
  const countVisibleSelected = useCallback(
    (plan: import('@/lib/planner/essence-solver').DungeonPlan): number => {
      let count = 0
      for (const { weapon, isSelected } of plan.matchedWeapons) {
        if (!isSelected) continue
        if (hideFourStarPlans && weapon.rarity === 4) continue
        if (hideUnownedPlans && weaponOwnership[weapon.id] !== true) continue
        if (hideEssenceOwnedPlans) {
          const eOwned = essenceStatus[weapon.id] === true
          const wOwned = weaponOwnership[weapon.id] === true
          if (onlyBothOwned) {
            if (eOwned && wOwned) continue
          } else {
            if (eOwned) continue
          }
        }
        count++
      }
      return count
    },
    [hideFourStarPlans, hideUnownedPlans, hideEssenceOwnedPlans, onlyBothOwned, weaponOwnership, essenceStatus],
  )

  // Apply region priority sorting (sorted by visible selected count)
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

      // 2. Visible selected count desc → 3. Total count desc
      const selDiff = countVisibleSelected(planB) - countVisibleSelected(planA)
      if (selDiff !== 0) return selDiff
      return planB.totalCount - planA.totalCount
    })

    return order
  }, [planOrder, plansMap, regionFirst, regionSecond, countVisibleSelected])

  // Apply region filter on top of sorted order
  const filteredPlanOrder = useMemo(() => {
    if (selectedRegions.size === 0 && selectedSubRegions.size === 0) return sortedPlanOrder
    return sortedPlanOrder.filter((key) => {
      const plan = plansMap[key]
      if (!plan) return false
      if (selectedRegions.size > 0 && !selectedRegions.has(getRegion(plan.dungeon))) return false
      if (selectedSubRegions.size > 0 && !selectedSubRegions.has(getSubRegion(plan.dungeon))) return false
      return true
    })
  }, [sortedPlanOrder, plansMap, selectedRegions, selectedSubRegions])

  // Weapons in current selection that have NO coverage under active region filter
  const weaponsNotCovered = useMemo(() => {
    if (selectedWeaponIds.length === 0) return []
    if (selectedRegions.size === 0 && selectedSubRegions.size === 0) return []
    const covered = new Set<string>()
    for (const key of filteredPlanOrder) {
      const plan = plansMap[key]
      if (!plan) continue
      for (const { weapon, isSelected } of plan.matchedWeapons) {
        if (isSelected) covered.add(weapon.id)
      }
    }
    return selectedWeaponIds.filter((id) => !covered.has(id))
  }, [filteredPlanOrder, selectedWeaponIds, plansMap, selectedRegions, selectedSubRegions])

  // Map weapon IDs to names for warning display
  const weaponNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of staticWeapons) map.set(w.id, w.name)
    for (const w of customWeapons) map.set(w.id, w.name)
    return map
  }, [customWeapons])

  // ── Region chip handlers ──

  const toggleRegion = useCallback((region: string) => {
    const arr = storeSelectedRegions
    const idx = arr.indexOf(region)
    let nextRegions: string[]
    if (idx >= 0) {
      nextRegions = arr.filter((r) => r !== region)
      // Clean up sub-region selections for deselected region
      const subs = subRegionsByRegion.get(region) ?? []
      const subSet = new Set(subs)
      const nextSubs = storeSelectedSubRegions.filter((s) => !subSet.has(s))
      if (nextSubs.length !== storeSelectedSubRegions.length) {
        setSelectedSubRegions(nextSubs)
      }
    } else {
      nextRegions = [...arr, region]
    }
    setSelectedRegions(nextRegions)
  }, [storeSelectedRegions, storeSelectedSubRegions, setSelectedRegions, setSelectedSubRegions, subRegionsByRegion])

  const toggleSubRegion = useCallback((region: string, sub: string) => {
    const arr = storeSelectedSubRegions
    const idx = arr.indexOf(sub)
    let next: string[]
    if (idx >= 0) {
      next = arr.filter((s) => s !== sub)
    } else {
      next = [...arr, sub]
      // If all subs of this region are now selected, revert to allActive
      const subs = subRegionsByRegion.get(region) ?? []
      if (subs.every((s) => next.includes(s))) {
        const subSet = new Set(subs)
        next = next.filter((s) => !subSet.has(s))
      }
    }
    setSelectedSubRegions(next)
  }, [storeSelectedSubRegions, setSelectedSubRegions, subRegionsByRegion])

  const toggleRegionSubsAll = useCallback((region: string) => {
    const subs = subRegionsByRegion.get(region) ?? []
    const anySelected = subs.some((s) => storeSelectedSubRegions.includes(s))
    if (!anySelected) return // already all-active, no-op
    const subSet = new Set(subs)
    setSelectedSubRegions(storeSelectedSubRegions.filter((s) => !subSet.has(s)))
  }, [storeSelectedSubRegions, setSelectedSubRegions, subRegionsByRegion])

  const clearRegionFilters = useCallback(() => {
    setSelectedRegions([])
    setSelectedSubRegions([])
  }, [setSelectedRegions, setSelectedSubRegions])

  // Fallback: compute plans on mount if weapons are selected but plans are missing
  // (covers the gap between React's first render and zustand persist async hydration)
  const computePlans = useMatrixStore((s) => s.computePlans)
  useEffect(() => {
    if (selectedWeaponIds.length > 0 && planOrder.length === 0 && !plansStale) {
      computePlans()
    }
  }, [selectedWeaponIds.length, planOrder.length, plansStale, computePlans])

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

    const hasRegionFilter = selectedRegions.size > 0 || selectedSubRegions.size > 0

    return (
      <div className="flex flex-col gap-3">
        {/* Region filter bar */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[10px] text-muted-foreground shrink-0">
            {t('essence.regionFilter')}
          </span>
          {/* All */}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={clearRegionFilters}
            className={cn(
              'h-auto px-2 py-0.5 rounded text-[11px] border transition-colors',
              !hasRegionFilter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-foreground/40',
            )}
          >
            {t('essence.regionFilterAll')}
          </Button>
          {/* Region chips */}
          {regions.map((region) => {
            const isSelected = selectedRegions.has(region)
            return (
              <Button
                key={region}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => toggleRegion(region)}
                className={cn(
                  'h-auto px-2 py-0.5 rounded text-[11px] border transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:border-foreground/40',
                )}
              >
                {region}
              </Button>
            )
          })}
        </div>

        {/* Sub-region rows — grouped by selected region */}
        {selectedRegions.size > 0 &&
          Array.from(selectedRegions).map((region) => {
            const subs = subRegionsByRegion.get(region) ?? []
            if (subs.length === 0) return null
            const allActive = subs.every((s) => !selectedSubRegions.has(s))
            return (
              <div
                key={region}
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
              >
                <span className="text-[10px] text-muted-foreground shrink-0 w-14 text-right">
                  {region}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => toggleRegionSubsAll(region)}
                  className={cn(
                    'h-auto px-2 py-0.5 rounded text-[11px] border transition-colors',
                    allActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-foreground/40',
                  )}
                >
                  {t('essence.regionFilterAll')}
                </Button>
                {subs.map((sub) => {
                  const isSelected = selectedSubRegions.has(sub)
                  return (
                    <Button
                      key={sub}
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => toggleSubRegion(region, sub)}
                      className={cn(
                        'h-auto px-2 py-0.5 rounded text-[11px] border transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-foreground/40',
                      )}
                    >
                      {sub}
                    </Button>
                  )
                })}
              </div>
            )
          })}

        {/* Warning: weapons not covered by current region filter */}
        {weaponsNotCovered.length > 0 && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600">
            {t('essence.weaponNotCoveredByRegion', {
              weapons: weaponsNotCovered.map((id) => weaponNameMap.get(id) ?? id).join('、'),
            })}
          </div>
        )}

        {/* Plan list */}
        {filteredPlanOrder.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('essence.noPlanMatch')}
          </div>
        ) : (
          filteredPlanOrder.map((planKey) => {
            const plan = plansMap[planKey]
            if (!plan) return null
            return (
              <DungeonCard
                key={planKey}
                plan={plan}
                isExpanded={expandedSet.has(planKey)}
              />
            )
          })
        )}
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
