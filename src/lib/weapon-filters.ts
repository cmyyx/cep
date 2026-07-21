import type { Weapon } from '@/types/matrix'

export type WeaponFilterKey = 'weaponType' | 'primaryStat' | 'elementalDamage' | 'specialAbility'
export type WeaponFilterSets = Record<WeaponFilterKey, Set<string>>

export const WEAPON_FILTER_KEYS: WeaponFilterKey[] = [
  'weaponType',
  'primaryStat',
  'elementalDamage',
  'specialAbility',
]

function filterValue(weapon: Weapon, key: WeaponFilterKey): string | null {
  return key === 'weaponType' ? weapon.type : weapon[key]
}

function matchesFilter(value: string | null, selected: ReadonlySet<string>): boolean {
  return selected.size === 0 || value === null || selected.has(value)
}

export function matchesWeaponFilters(weapon: Weapon, filters: WeaponFilterSets): boolean {
  return WEAPON_FILTER_KEYS.every((key) => matchesFilter(filterValue(weapon, key), filters[key]))
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
  }
  for (const key of WEAPON_FILTER_KEYS) {
    for (const weapon of weapons) {
      const matchesOtherFilters = WEAPON_FILTER_KEYS.every((otherKey) =>
        otherKey === key || matchesFilter(filterValue(weapon, otherKey), filters[otherKey])
      )
      const value = filterValue(weapon, key)
      if (matchesOtherFilters && value !== null) result[key].add(value)
    }
  }
  return result
}
