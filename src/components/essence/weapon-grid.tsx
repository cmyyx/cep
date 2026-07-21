'use client'

import { memo, useMemo, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { FilterChip } from '@/components/shared/filter-chip'
import { WeaponCard } from './weapon-card'
import { SelectedWeaponsStrip } from './selected-weapons-strip'
import { weapons as staticWeapons } from '@/data/weapons'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { useBannerStore } from '@/stores/useBannerStore'
import { OwnershipBadge, EditableNote } from './ownership-badge'
import { ALL_PRIMARY_STATS, ALL_ELEMENTAL_DAMAGE, ALL_SPECIAL_ABILITIES } from '@/lib/essence-utils'
import { getValidWeaponFilterOptions, matchesWeaponFilters, WEAPON_FILTER_KEYS, type WeaponFilterKey, type WeaponFilterSets } from '@/lib/weapon-filters'


const ATTR_KEYS: WeaponFilterKey[] = WEAPON_FILTER_KEYS

import type { Weapon } from '@/types/matrix'

/** 返回武器筛选的完整候选值：weaponType 根据传入的 weapons 动态生成；
 *  ALL_PRIMARY_STATS、ALL_ELEMENTAL_DAMAGE、ALL_SPECIAL_ABILITIES
 *  分别在导入时从 dungeon s1Pool/s2Pool/s3Pool 静态计算。 */
function buildAttrValues(weapons: readonly Weapon[]): Record<WeaponFilterKey, string[]> {
  return {
    weaponType: [...new Set(weapons.map((weapon) => weapon.type))].sort(),
    primaryStat: ALL_PRIMARY_STATS,
    elementalDamage: ALL_ELEMENTAL_DAMAGE,
    specialAbility: ALL_SPECIAL_ABILITIES,
  }
}
const ATTR_LABEL_KEYS: Record<WeaponFilterKey, string> = {
  weaponType: 'essence.weaponType',
  primaryStat: 'essence.attrPrimary',
  elementalDamage: 'essence.attrElemental',
  specialAbility: 'essence.attrSpecial',
}

const WEAPON_TYPE_LABEL_KEYS: Record<string, string> = {
  '单手剑': 'essence.weaponTypes.oneHandedSword',
  '施术单元': 'essence.weaponTypes.casterUnit',
  '双手剑': 'essence.weaponTypes.greatsword',
  '长柄武器': 'essence.weaponTypes.polearm',
  '手铳': 'essence.weaponTypes.pistol',
}


function attrFiltersToSets(record: Record<string, string[]>): WeaponFilterSets {
  return {
    weaponType: new Set(record.weaponType ?? []),
    primaryStat: new Set(record.primaryStat ?? []),
    elementalDamage: new Set(record.elementalDamage ?? []),
    specialAbility: new Set(record.specialAbility ?? []),
  }
}

// ─── Selected Weapons Strip ────────────────────────────────────────────────
// Moved to ./selected-weapons-strip.tsx

interface WeaponGridProps {
  onViewAll?: () => void
}

export const WeaponGrid = memo(function WeaponGrid({ onViewAll }: WeaponGridProps) {
  const t = useTranslations()
  const filterCollapsed = useEssenceSettingsStore((s) => s.weaponFilterCollapsed)
  const toggleFilterCollapsed = useEssenceSettingsStore((s) => s.toggleWeaponFilterCollapsed)
  const selectedWeaponIds = useMatrixStore((s) => s.selectedWeaponIds)
  const toggleWeapon = useMatrixStore((s) => s.toggleWeapon)

  // Shared filter state (lifted to store so desktop/mobile instances stay in sync)
  const query = useMatrixStore((s) => s.weaponSearchQuery)
  const setQuery = useMatrixStore((s) => s.setWeaponSearchQuery)
  const storeAttrFilters = useMatrixStore((s) => s.weaponAttrFilters)
  const setStoreAttrFilters = useMatrixStore((s) => s.setWeaponAttrFilters)
  const setVisibleWeaponIds = useMatrixStore((s) => s.setVisibleWeaponIds)

  const filters = useMemo(() => attrFiltersToSets(storeAttrFilters), [storeAttrFilters])

  // Banner UP character names (reactive via store, refreshed every 60s)
  const upCharacterNames = useBannerStore((s) => s.upCharacterNames)
  const upCharSet = useMemo(() => new Set(upCharacterNames), [upCharacterNames])

  // Settings
  const hideFourStar = useEssenceSettingsStore((s) => s.hideFourStarWeaponsList)
  const hideThreeStar = useEssenceSettingsStore((s) => s.hideThreeStarWeaponsList)
  const hideUnowned = useEssenceSettingsStore((s) => s.hideUnownedWeaponsList)
  const hideEssenceOwned = useEssenceSettingsStore((s) => s.hideEssenceOwnedWeaponsList)
  const onlyBothOwned = useEssenceSettingsStore((s) => s.onlyHideWhenBothOwnedList)
  const keepUpVisibleList = useEssenceSettingsStore((s) => s.keepUpVisibleList)
  const enableOwnershipEdit = useEssenceSettingsStore((s) => s.enableOwnershipEditList)
  const enableNotes = useEssenceSettingsStore((s) => s.enableNotesList)
  const weaponOwnership = useEssenceSettingsStore((s) => s.weaponOwnership)
  const essenceStatus = useEssenceSettingsStore((s) => s.essenceStatus)
  const weaponNotes = useEssenceSettingsStore((s) => s.weaponNotes)
  const customWeapons = useEssenceSettingsStore((s) => s.customWeapons)
  const setWeaponOwnership = useEssenceSettingsStore((s) => s.setWeaponOwnership)
  const setEssenceStatus = useEssenceSettingsStore((s) => s.setEssenceStatus)
  const setWeaponNote = useEssenceSettingsStore((s) => s.setWeaponNote)

  /** Check whether any of a weapon's characters is currently on banner. */
  const isWeaponUp = useCallback(
    (weapon: Weapon) => weapon.chars.length > 0 && weapon.chars.some((c) => upCharSet.has(c)),
    [upCharSet],
  )

  // Combined weapon list: custom → preview → banner UP → rest
  const allWeapons = useMemo(() => {
    const previewWeapons: Weapon[] = []
    const bannerWeapons: Weapon[] = []
    const otherWeapons: Weapon[] = []

    for (const w of staticWeapons) {
      if (isWeaponUp(w)) {
        bannerWeapons.push(w)
      } else if (w.source === 'preview') {
        previewWeapons.push(w)
      } else {
        otherWeapons.push(w)
      }
    }

    const sortWeapons = (weapons: Weapon[]) => {
      return weapons.sort((a, b) => {
        if (a.rarity !== b.rarity) {
          return b.rarity - a.rarity
        }
        return a.name.localeCompare(b.name, 'zh-CN')
      })
    }

    sortWeapons(previewWeapons)
    sortWeapons(bannerWeapons)
    sortWeapons(otherWeapons)

    return [...customWeapons, ...previewWeapons, ...bannerWeapons, ...otherWeapons]
  }, [customWeapons, isWeaponUp])

  // Dynamic attr values based on full weapon list
  const attrValues = useMemo(() => buildAttrValues(allWeapons), [allWeapons])

  // O(1) membership test instead of O(n) Array.includes
  const selectedSet = useMemo(
    () => new Set(selectedWeaponIds),
    [selectedWeaponIds],
  )

  const toggleFilter = useCallback((key: WeaponFilterKey, value: string) => {
    const prev = useMatrixStore.getState().weaponAttrFilters
    const current = new Set(prev[key] ?? [])
    if (current.has(value)) current.delete(value)
    else current.add(value)
    setStoreAttrFilters({ ...prev, [key]: Array.from(current) })
  }, [setStoreAttrFilters])

  // Base filter predicate: query + hide settings
  const matchesBaseFilters = useCallback((w: Weapon) => {
    if (query && !w.name.includes(query) && !w.type.includes(query)) return false
    if (keepUpVisibleList && (isWeaponUp(w) || w.source === 'preview')) return true
    if ((hideFourStar && w.rarity === 4) || (hideThreeStar && w.rarity === 3)) return false
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
  }, [query, keepUpVisibleList, isWeaponUp, hideFourStar, hideThreeStar, hideUnowned, hideEssenceOwned, onlyBothOwned, weaponOwnership, essenceStatus])

  const validOptions = useMemo(() => {
    const eligibleWeapons = allWeapons.filter(matchesBaseFilters)
    return getValidWeaponFilterOptions(eligibleWeapons, filters)
  }, [allWeapons, filters, matchesBaseFilters])

  const filteredWeapons = useMemo(
    () => allWeapons.filter((weapon) => matchesBaseFilters(weapon) && matchesWeaponFilters(weapon, filters)),
    [allWeapons, filters, matchesBaseFilters]
  )

  // Write visible weapon IDs to shared store so select-all button can read them
  const visibleIds = useMemo(
    () => filteredWeapons.map((w) => w.id),
    [filteredWeapons],
  )
  useEffect(() => {
    setVisibleWeaponIds(visibleIds)
  }, [visibleIds, setVisibleWeaponIds])

  // Build O(1) lookup map for selected weapon strip
  const selectedWeaponsMap = useMemo(() => {
    const map = new Map<string, Weapon>()
    for (const w of allWeapons) map.set(w.id, w)
    return map
  }, [allWeapons])

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder={t('essence.searchWeapon')} value={query} onChange={(e) => setQuery(e.target.value)} className="text-sm" />

      {/* Selected weapons strip */}
      <SelectedWeaponsStrip
        selectedIds={selectedWeaponIds}
        weaponsMap={selectedWeaponsMap}
        onToggleWeapon={toggleWeapon}
        onViewAll={onViewAll}
      />

      {/* Attribute filter — collapsible */}
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={toggleFilterCollapsed}
          aria-expanded={!filterCollapsed}
          className="flex min-h-10 w-full items-center gap-2 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn('size-4 transition-transform', filterCollapsed ? '-rotate-90' : 'rotate-0')} />
          <span className="flex-1 text-left">{t('essence.attrFilterTitle')}</span>
        </Button>
        <div
          id="weapon-attr-filter"
          className={cn(
            'grid transition-all duration-200 ease-out',
            filterCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="overflow-hidden">
            <div className="mt-1.5 flex flex-col gap-2">
              {ATTR_KEYS.map((key) => {
                const values = attrValues[key]
                const valid = validOptions[key]
                const selected = filters[key]
                const isSpecialAbility = key === 'specialAbility'
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">{t(ATTR_LABEL_KEYS[key])}</span>
                    <div className={isSpecialAbility ? 'grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1' : 'grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1'}>
                      {values.map((value) => (
                        <FilterChip
                          key={value}
                          value={value}
                          label={key === 'weaponType' ? t(WEAPON_TYPE_LABEL_KEYS[value] ?? value) : t(`weaponStats.${value}`)}
                          isValid={valid.has(value)}
                          isSelected={selected.has(value)}
                          onToggle={() => toggleFilter(key, value)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
        {filteredWeapons.map((weapon) => (
          <div key={weapon.id} className="flex flex-col gap-0.5">
            <WeaponCard
              weapon={weapon}
              isSelected={selectedSet.has(weapon.id)}
              isOnBanner={isWeaponUp(weapon)}
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
