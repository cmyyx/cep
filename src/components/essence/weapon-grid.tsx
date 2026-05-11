'use client'

import { memo, useState, useRef, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WeaponCard } from './weapon-card'
import { weapons as staticWeapons } from '@/data/weapons'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { OwnershipBadge, EditableNote } from './ownership-badge'
import { isWeaponOnBanner } from '@/lib/banner-utils'

type AttrKey = keyof Pick<Weapon, 'primaryStat' | 'elementalDamage' | 'specialAbility'>

const ATTR_KEYS: AttrKey[] = ['primaryStat', 'elementalDamage', 'specialAbility']

import type { Weapon } from '@/types/matrix'

/** Precomputed sorted unique values for each attribute (static data). */
function getValues(key: AttrKey, weaponsArr: Weapon[]): string[] {
  return [...new Set(weaponsArr.map((w) => w[key]))].sort()
}

/** Build attr values from full weapon list (static + custom). */
function buildAttrValues(allWeapons: Weapon[]): Record<AttrKey, string[]> {
  return {
    primaryStat: getValues('primaryStat', allWeapons),
    elementalDamage: getValues('elementalDamage', allWeapons),
    specialAbility: getValues('specialAbility', allWeapons),
  }
}

const ATTR_LABEL_KEYS: Record<AttrKey, string> = {
  primaryStat: 'essence.attrPrimary',
  elementalDamage: 'essence.attrElemental',
  specialAbility: 'essence.attrSpecial',
}

const FilterChip = memo(function FilterChip({
  value,
  isValid,
  isSelected,
  onToggle,
}: {
  value: string
  isValid: boolean
  isSelected: boolean
  onToggle: () => void
}) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Block opening when text fits (scrollWidth === clientWidth)
      if (open && spanRef.current && spanRef.current.scrollWidth <= spanRef.current.clientWidth) {
        return
      }
      setTooltipOpen(open)
    },
    [],
  )

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleOpenChange}>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!isValid && !isSelected}
            onClick={onToggle}
            aria-pressed={isSelected}
            className={cn(
              'w-full px-1 py-0.5 rounded text-[11px] text-center border transition-colors bg-muted/60 h-auto min-h-0 min-w-0',
              isSelected && 'bg-primary text-primary-foreground border-primary',
              !isSelected && isValid && 'border-border hover:border-foreground/40 hover:bg-muted/80',
              !isValid && !isSelected && 'border-border/60 text-muted-foreground/40 line-through cursor-not-allowed',
            )}
          />
        }
      >
        <span ref={spanRef} className="truncate min-w-0">{value}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {value}
      </TooltipContent>
    </Tooltip>
  )
})

interface WeaponGridProps {
  initialFilterCollapsed?: boolean
}

export const WeaponGrid = memo(function WeaponGrid({ initialFilterCollapsed = false }: WeaponGridProps) {
  const t = useTranslations()
  const [query, setQuery] = useState('')
  const [filterCollapsed, setFilterCollapsed] = useState(initialFilterCollapsed)
  const [filters, setFilters] = useState<Record<AttrKey, Set<string>>>({
    primaryStat: new Set(),
    elementalDamage: new Set(),
    specialAbility: new Set(),
  })
  const selectedWeaponIds = useMatrixStore((s) => s.selectedWeaponIds)

  // Settings
  const hideFourStar = useEssenceSettingsStore((s) => s.hideFourStarWeaponsList)
  const hideUnowned = useEssenceSettingsStore((s) => s.hideUnownedWeaponsList)
  const hideEssenceOwned = useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsList)
  const onlyBothOwned = useEssenceSettingsStore((s) => s.onlyHideWhenBothOwned)
  const enableOwnershipEdit = useEssenceSettingsStore((s) => s.enableOwnershipEditList)
  const enableNotes = useEssenceSettingsStore((s) => s.enableNotesList)
  const weaponOwnership = useEssenceSettingsStore((s) => s.weaponOwnership)
  const essenceStatus = useEssenceSettingsStore((s) => s.essenceStatus)
  const weaponNotes = useEssenceSettingsStore((s) => s.weaponNotes)
  const customWeapons = useEssenceSettingsStore((s) => s.customWeapons)
  const setWeaponOwnership = useEssenceSettingsStore((s) => s.setWeaponOwnership)
  const setEssenceStatus = useEssenceSettingsStore((s) => s.setEssenceStatus)
  const setWeaponNote = useEssenceSettingsStore((s) => s.setWeaponNote)

  // Combined weapon list: custom first, then banner UP, then alphabetical
  const allWeapons = useMemo(() => {
    const bannerWeapons: Weapon[] = []
    const otherWeapons: Weapon[] = []

    for (const w of staticWeapons) {
      if (isWeaponOnBanner(w)) {
        bannerWeapons.push(w)
      } else {
        otherWeapons.push(w)
      }
    }

    // Sort function: rarity desc (6,5,4), then name asc
    const sortWeapons = (weapons: Weapon[]) => {
      return weapons.sort((a, b) => {
        if (a.rarity !== b.rarity) {
          return b.rarity - a.rarity
        }
        return a.name.localeCompare(b.name, 'zh-CN')
      })
    }

    sortWeapons(bannerWeapons)
    sortWeapons(otherWeapons)

    return [...customWeapons, ...bannerWeapons, ...otherWeapons]
  }, [customWeapons])

  // Dynamic attr values based on full weapon list
  const attrValues = useMemo(() => buildAttrValues(allWeapons), [allWeapons])

  // O(1) membership test instead of O(n) Array.includes
  const selectedSet = useMemo(
    () => new Set(selectedWeaponIds),
    [selectedWeaponIds],
  )

  const toggleFilter = useCallback((key: AttrKey, value: string) => {
    setFilters((prev) => {
      const next = new Set(prev[key])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [key]: next }
    })
  }, [])

  // Base filter predicate: query + hide settings (shared by filteredWeapons and validOptions)
  const matchesBaseFilters = useCallback((w: Weapon) => {
    if (query && !w.name.includes(query) && !w.type.includes(query)) return false
    if (hideFourStar && w.rarity === 4) return false
    if (hideUnowned && weaponOwnership[w.id] !== true) return false
    if (hideEssenceOwned) {
      const eOwned = essenceStatus[w.id] === true
      const wOwned = weaponOwnership[w.id] === true
      if (onlyBothOwned) {
        if (eOwned && wOwned) return false
      } else {
        if (eOwned) return false
      }
    }
    return true
  }, [query, hideFourStar, hideUnowned, hideEssenceOwned, onlyBothOwned, weaponOwnership, essenceStatus])

  // Compute valid options for each category given selections in other categories
  const validOptions = useMemo(() => {
    const result: Record<AttrKey, Set<string>> = {
      primaryStat: new Set(),
      elementalDamage: new Set(),
      specialAbility: new Set(),
    }

    for (const key of ATTR_KEYS) {
      const otherKeys = ATTR_KEYS.filter((k) => k !== key)
      const otherFilters = otherKeys.filter((k) => filters[k].size > 0)

      for (const weapon of allWeapons) {
        // Apply base filters (query, hide settings) + other attribute filters
        if (!matchesBaseFilters(weapon)) continue
        let matchesOthers = true
        for (const ok of otherFilters) {
          if (!filters[ok].has(weapon[ok])) {
            matchesOthers = false
            break
          }
        }
        if (matchesOthers) {
          result[key].add(weapon[key])
        }
      }
    }

    return result
  }, [filters, allWeapons, matchesBaseFilters])

  // Filter weapons (attr + search + hide settings)
  const filteredWeapons = useMemo(() => {
    return allWeapons.filter((w) => {
      if (!matchesBaseFilters(w)) return false
      for (const key of ATTR_KEYS) {
        if (filters[key].size > 0 && !filters[key].has(w[key])) return false
      }
      return true
    })
  }, [allWeapons, matchesBaseFilters, filters])

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder={t('essence.searchWeapon')} value={query} onChange={(e) => setQuery(e.target.value)} className="text-sm" />

      {/* Attribute filter — collapsible */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setFilterCollapsed((v) => !v)}
          className="flex w-full items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors h-auto p-0"
        >
          <span className="flex-1 text-left">{t('essence.attrFilterTitle')}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('transition-transform', filterCollapsed ? '-rotate-90' : 'rotate-0')}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Button>
        <div
          className={cn(
            'grid transition-all duration-200 ease-out',
            filterCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 mt-1.5">
            {ATTR_KEYS.map((key) => {
              const values = attrValues[key]
              const valid = validOptions[key]
              const selected = filters[key]
              return (
                <div key={key} className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground">{t(ATTR_LABEL_KEYS[key])}</span>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1">
                    {values.map((v) => {
                      const isValid = valid.has(v)
                      const isSelected = selected.has(v)
                      return (
                        <FilterChip
                          key={v}
                          value={v}
                          isValid={isValid}
                          isSelected={isSelected}
                          onToggle={() => toggleFilter(key, v)}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {filteredWeapons.map((weapon) => (
          <div key={weapon.id} className="flex flex-col gap-0.5">
            <WeaponCard
              weapon={weapon}
              isSelected={selectedSet.has(weapon.id)}
              isOnBanner={isWeaponOnBanner(weapon)}
            />
            {enableOwnershipEdit && (
              <div className="flex items-center justify-center gap-1">
                <OwnershipBadge
                  active={weaponOwnership[weapon.id] === true}
                  onToggle={() =>
                    setWeaponOwnership(weapon.id, !weaponOwnership[weapon.id])
                  }
                  label={t('essence.weaponOwnershipLabel')}
                  activeColor="emerald"
                />
                <OwnershipBadge
                  active={essenceStatus[weapon.id] === true}
                  onToggle={() =>
                    setEssenceStatus(weapon.id, !essenceStatus[weapon.id])
                  }
                  label={t('essence.essenceOwnershipLabel')}
                  activeColor="sky"
                />
              </div>
            )}
            {enableNotes && (
              <EditableNote
                note={weaponNotes[weapon.id] || ''}
                onSave={(value) => setWeaponNote(weapon.id, value)}
              />
            )}
          </div>
        ))}
      </div>
      {filteredWeapons.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{t('essence.noWeaponMatch')}</p>
      )}
    </div>
  )
})
