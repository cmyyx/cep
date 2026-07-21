import { describe, expect, it } from 'vitest'
import { getValidWeaponFilterOptions, matchesWeaponFilters, type WeaponFilterSets } from './weapon-filters'
import type { Weapon } from '@/types/matrix'

const weapons: Weapon[] = [
  { id: 'sword', name: '剑', rarity: 6, type: '单手剑', primaryStat: 'str', elementalDamage: 'fire', specialAbility: 'burst', chars: [] },
  { id: 'pistol', name: '铳', rarity: 6, type: '手铳', primaryStat: 'agi', elementalDamage: 'fire', specialAbility: 'burst', chars: [] },
  { id: 'funnel', name: '单元', rarity: 5, type: '施术单元', primaryStat: 'wisd', elementalDamage: 'cryst', specialAbility: 'combo', chars: [] },
  { id: 'wildcard', name: '三星', rarity: 3, type: '双手剑', primaryStat: 'main', elementalDamage: 'atk', specialAbility: null, chars: [] },
]

function filters(values: Partial<Record<keyof WeaponFilterSets, string[]>> = {}): WeaponFilterSets {
  return {
    weaponType: new Set(values.weaponType ?? []),
    primaryStat: new Set(values.primaryStat ?? []),
    elementalDamage: new Set(values.elementalDamage ?? []),
    specialAbility: new Set(values.specialAbility ?? []),
  }
}

describe('weapon filters', () => {
  it('filters by weapon type together with other attributes', () => {
    const selected = filters({ weaponType: ['手铳'], elementalDamage: ['fire'] })
    expect(weapons.filter((weapon) => matchesWeaponFilters(weapon, selected)).map((weapon) => weapon.id)).toEqual(['pistol'])
  })

  it('computes valid options from selections in the other dimensions', () => {
    const selected = filters({ weaponType: ['手铳'] })
    const options = getValidWeaponFilterOptions(weapons, selected)

    expect([...options.primaryStat]).toEqual(['agi'])
    expect([...options.elementalDamage]).toEqual(['fire'])
    expect([...options.specialAbility]).toEqual(['burst'])
    expect([...options.weaponType].sort()).toEqual(['单手剑', '双手剑', '手铳', '施术单元'].sort())
  })

  it('treats a wildcard slot as compatible without exposing a fake filter option', () => {
    const selected = filters({ specialAbility: ['combo'] })
    expect(weapons.filter((weapon) => matchesWeaponFilters(weapon, selected)).map((weapon) => weapon.id)).toEqual(['funnel', 'wildcard'])
    expect([...getValidWeaponFilterOptions(weapons, filters()).specialAbility].sort()).toEqual(['burst', 'combo'])
  })
})
