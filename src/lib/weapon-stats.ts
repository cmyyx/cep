import type { Weapon } from '@/types/matrix'

export type WeaponStatKey = 'primaryStat' | 'elementalDamage' | 'specialAbility'

export const WILDCARD_SELECT_VALUE = '__wildcard__'

export function weaponStatLabel(
  value: string | null,
  translate: (key: string) => string,
): string {
  return value === null ? translate('essence.anyAttribute') : translate(`weaponStats.${value}`)
}

export function weaponStatSelectValue(value: string | null): string {
  return value ?? WILDCARD_SELECT_VALUE
}

export function weaponStatFromSelect(value: string): string | null {
  return value === WILDCARD_SELECT_VALUE ? null : value
}

export function weaponMatchesS1(weapon: Weapon, selectedS1: readonly string[]): boolean {
  return weapon.primaryStat === null || selectedS1.includes(weapon.primaryStat)
}
