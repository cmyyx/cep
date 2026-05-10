'use client'

import { memo, useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { WeaponCard } from './weapon-card'
import { weapons } from '@/data/weapons'
import { useMatrixStore } from '@/stores/useMatrixStore'

type AttrKey = keyof Pick<Weapon, 'primaryStat' | 'elementalDamage' | 'specialAbility'>

const ATTR_KEYS: AttrKey[] = ['primaryStat', 'elementalDamage', 'specialAbility']

import type { Weapon } from '@/types/matrix'

/** Precomputed sorted unique values for each attribute (static data). */
function getValues(key: AttrKey): string[] {
  return [...new Set(weapons.map((w) => w[key]))].sort()
}

const ATTR_VALUES: Record<AttrKey, string[]> = {
  primaryStat: getValues('primaryStat'),
  elementalDamage: getValues('elementalDamage'),
  specialAbility: getValues('specialAbility'),
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

      for (const weapon of weapons) {
        // Check if weapon matches all filters in other categories
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
  }, [filters])

  // Filter weapons
  const filteredWeapons = useMemo(() => {
    return weapons.filter((w) => {
      if (query && !w.name.includes(query) && !w.type.includes(query)) return false
      for (const key of ATTR_KEYS) {
        if (filters[key].size > 0 && !filters[key].has(w[key])) return false
      }
      return true
    })
  }, [query, filters])

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
        {!filterCollapsed && (
          <div className="flex flex-col gap-2 mt-1.5">
            {ATTR_KEYS.map((key) => {
              const values = ATTR_VALUES[key]
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
                            'w-full px-1 py-0.5 rounded text-[11px] text-center border transition-colors truncate',
                            isSelected && 'bg-primary text-primary-foreground border-primary',
                            !isSelected && isValid && 'border-border hover:border-foreground/30',
                            !isValid && !isSelected && 'border-border/30 text-muted-foreground/30 line-through cursor-not-allowed',
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
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {filteredWeapons.map((weapon) => (
          <WeaponCard
            key={weapon.id}
            weapon={weapon}
            isSelected={selectedSet.has(weapon.id)}
          />
        ))}
      </div>
      {filteredWeapons.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{t('essence.noWeaponMatch')}</p>
      )}
    </div>
  )
})
