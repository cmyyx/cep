import type { Weapon } from '@/types/matrix'

export type WeaponFilterKey = 'weaponType' | 'primaryStat' | 'elementalDamage' | 'specialAbility' | 'acquisitionCategory'
export type WeaponFilterSets = Record<WeaponFilterKey, Set<string>>

export const WEAPON_FILTER_KEYS: WeaponFilterKey[] = [
  'weaponType',
  'primaryStat',
  'elementalDamage',
  'specialAbility',
  'acquisitionCategory',
]

/**
 * Candidate values of one filter for a weapon. `null` means the weapon has
 * no data for this dimension (e.g. custom weapons without acquisition
 * sources) and therefore passes every filter — unknown is never hideable.
 * Acquisition categories are multi-valued and match with OR semantics.
 */
function filterValues(weapon: Weapon, key: WeaponFilterKey): string[] | null {
  if (key === 'acquisitionCategory') {
    const categories = weapon.acquisitionSources?.map((source) => source.categoryId) ?? []
    return categories.length > 0 ? categories : null
  }
  const value = key === 'weaponType' ? weapon.type : weapon[key]
  return value === null ? null : [value]
}

function matchesFilter(values: string[] | null, selected: ReadonlySet<string>): boolean {
  return selected.size === 0 || values === null || values.some((value) => selected.has(value))
}

export function matchesWeaponFilters(weapon: Weapon, filters: WeaponFilterSets): boolean {
  return WEAPON_FILTER_KEYS.every((key) => matchesFilter(filterValues(weapon, key), filters[key]))
}

export function getValidWeaponFilterOptions(
  weapons: readonly Weapon[],
  filters: WeaponFilterSets
): WeaponFilterSets {
  const result: WeaponFilterSets = {
    weaponType: new Set(),
    primaryStat: new Set(),
    elementalDamage: new Set(),
    specialAbility: new Set(),
    acquisitionCategory: new Set(),
  }
  for (const key of WEAPON_FILTER_KEYS) {
    for (const weapon of weapons) {
      const matchesOtherFilters = WEAPON_FILTER_KEYS.every((otherKey) =>
        otherKey === key || matchesFilter(filterValues(weapon, otherKey), filters[otherKey])
      )
      if (!matchesOtherFilters) continue
      for (const value of filterValues(weapon, key) ?? []) result[key].add(value)
    }
  }
  return result
}
