import { describe, it, expect } from 'vitest'
import { solve } from './essence-solver'
import type { Weapon, Dungeon } from '@/types/matrix'

const allWeapons: Weapon[] = [
  { id: 'w1', name: '武器A', rarity: 6, type: '单手剑', primaryStat: '力量提升', elementalDamage: '攻击提升', specialAbility: '压制', chars: [], imageId: 'wpn_sword_0001' },
  { id: 'w2', name: '武器B', rarity: 5, type: '施术单元', primaryStat: '敏捷提升', elementalDamage: '攻击提升', specialAbility: '效益', chars: [], imageId: 'wpn_sword_0001' },
  { id: 'w3', name: '武器C', rarity: 6, type: '手铳', primaryStat: '力量提升', elementalDamage: '寒冷伤害提升', specialAbility: '压制', chars: [], imageId: 'wpn_sword_0001' },
  { id: 'w4', name: '武器D', rarity: 4, type: '双手剑', primaryStat: '智识提升', elementalDamage: '攻击提升', specialAbility: '压制', chars: [], imageId: 'wpn_sword_0001' },
  { id: 'w5', name: '武器E', rarity: 6, type: '长柄武器', primaryStat: '意志提升', elementalDamage: '灼热伤害提升', specialAbility: '迸发', chars: [], imageId: 'wpn_sword_0001' },
]

const mockDungeons: Dungeon[] = [
  { id: 'hub', name: '枢纽区', s2Pool: ['攻击提升', '寒冷伤害提升', '灼热伤害提升'], s3Pool: ['压制', '效益', '迸发'] },
]

describe('essence-solver', () => {
  it('generates s2-lock plans', () => {
    const selected = new Set(['w1'])
    const result = solve(selected, allWeapons, mockDungeons)

    const s2Plans = result.dungeonPlans.filter((p) => p.lockType === 's2')
    expect(s2Plans.length).toBeGreaterThan(0)
    // s2-lock on '攻击提升' should match w1, w2, w4
    const s2Attack = s2Plans.find((p) => p.lockValue === '攻击提升')
    expect(s2Attack).toBeDefined()
    expect(s2Attack!.totalCount).toBeGreaterThanOrEqual(3)
  })

  it('generates s3-lock plans', () => {
    const selected = new Set(['w1'])
    const result = solve(selected, allWeapons, mockDungeons)

    const s3Plans = result.dungeonPlans.filter((p) => p.lockType === 's3')
    expect(s3Plans.length).toBeGreaterThan(0)
  })

  it('ranks selected weapons first', () => {
    const selected = new Set(['w4'])
    const result = solve(selected, allWeapons, mockDungeons)

    for (const plan of result.dungeonPlans) {
      if (plan.selectedCount > 0) {
        // First items should be selected
        const firstSelected = plan.matchedWeapons.slice(0, plan.selectedCount)
        expect(firstSelected.every((m) => m.isSelected)).toBe(true)
      }
    }
  })

  it('returns empty for empty selection', () => {
    const result = solve(new Set(), allWeapons, mockDungeons)
    // Should still produce plans (they just have selectedCount=0)
    // But getPlansForSelection in store handles empty by returning []
    expect(result.dungeonPlans.length).toBeGreaterThan(0)
    expect(result.dungeonPlans.every((p) => p.selectedCount === 0)).toBe(true)
  })
})
