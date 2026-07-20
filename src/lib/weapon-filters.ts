import type { Weapon } from '@/types/matrix'

export type WeaponFilterKey = 'weaponType' | 'primaryStat' | 'elementalDamage' | 'specialAbility'
export type WeaponFilterSets = Record<WeaponFilterKey, Set<string>>

export const WEAPON_FILTER_KEYS: WeaponFilterKey[] = [
  'weaponType',
  'primaryStat',
  'elementalDamage',
  'specialAbility',
]

export function matchesWeaponFilters(weapon: Weapon, filters: WeaponFilterSets): boolean {
  return WEAPON_FILTER_KEYS.every((key) => filters[key].size === 0 || filters[key].has(weapon[key === 'weaponType' ? 'type' : key]))
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
      const matchesOtherFilters = WEAPON_FILTER_KEYS.every((otherKey) => {
        if (otherKey === key || filters[otherKey].size === 0) return true
        return filters[otherKey].has(weapon[otherKey === 'weaponType' ? 'type' : otherKey])
      })
      if (matchesOtherFilters) result[key].add(weapon[key === 'weaponType' ? 'type' : key])
    }
  }
  return result
}
