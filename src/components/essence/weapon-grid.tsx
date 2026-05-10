'use client'

import { memo, useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { WeaponCard } from './weapon-card'
import { weapons as staticWeapons } from '@/data/weapons'
import { useMatrixStore } from '@/stores/useMatrixStore'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { OwnershipBadge, EditableNote } from './ownership-badge'

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

export const WeaponGrid = memo(function WeaponGrid() {
  const t = useTranslations()
  const [query, setQuery] = useState('')
  const [filterCollapsed, setFilterCollapsed] = useState(false)
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

  // Combined weapon list (custom first, then static)
  const allWeapons = useMemo(
    () => [...customWeapons, ...staticWeapons],
    [customWeapons],
  )

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
  }, [filters, allWeapons])

  // Filter weapons (attr + search + hide settings)
  const filteredWeapons = useMemo(() => {
    return allWeapons.filter((w) => {
      // Search query
      if (query && !w.name.includes(query) && !w.type.includes(query)) return false
      // Attribute filters
      for (const key of ATTR_KEYS) {
        if (filters[key].size > 0 && !filters[key].has(w[key])) return false
      }
      // Hide 4-star
      if (hideFourStar && w.rarity === 4) return false
      // Hide unowned
      if (hideUnowned && weaponOwnership[w.id] !== true) return false
      // Hide essence-owned
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
    })
  }, [
    query, filters, allWeapons,
    hideFourStar, hideUnowned, hideEssenceOwned, onlyBothOwned,
    weaponOwnership, essenceStatus,
  ])

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder={t('essence.searchWeapon')} value={query} onChange={(e) => setQuery(e.target.value)} className="text-sm" />

      {/* Attribute filter — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setFilterCollapsed((v) => !v)}
          className="flex w-full items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
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
        </button>
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
                        <button
                          key={v}
                          type="button"
                          disabled={!isValid && !isSelected}
                          onClick={() => toggleFilter(key, v)}
                          className={cn(
                            'w-full px-1 py-0.5 rounded text-[11px] text-center border transition-colors truncate bg-muted/60',
                            isSelected && 'bg-primary text-primary-foreground border-primary',
                            !isSelected && isValid && 'border-border hover:border-foreground/40 hover:bg-muted/80',
                            !isValid && !isSelected && 'border-border/60 text-muted-foreground/40 line-through cursor-not-allowed',
                          )}
                        >
                          {v}
                        </button>
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
            />
            {enableOwnershipEdit && (
              <div className="flex items-center justify-center gap-1">
                <OwnershipBadge
                  active={weaponOwnership[weapon.id] === true}
                  onToggle={() =>
                    setWeaponOwnership(weapon.id, !weaponOwnership[weapon.id])
                  }
                  label="武器"
                  activeColor="emerald"
                />
                <OwnershipBadge
                  active={essenceStatus[weapon.id] === true}
                  onToggle={() =>
                    setEssenceStatus(weapon.id, !essenceStatus[weapon.id])
                  }
                  label="基质"
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
