import { expect, it } from 'vitest'
import {
  buildPotentialStats,
  PLANNER_FARMABLE_DUNGEON_CATEGORIES,
  PLANNER_SS_SERVER_YIELD_PER_RUN,
  resolveFarmYieldCount,
  staticSetValues,
} from './generate-planner-data'
import type { AttrShowConfig } from './equip-stat-format'

it('preserves fixed potential stats and normalizes percentage metadata', () => {
  const attrTypeMap = new Map<number, AttrShowConfig>([
    [39, { name: 'Strength', entries: [{ attributeModifier: 5, showPercent: false, valueFormat: '{value}' }] }],
    [50, { name: 'Physical damage', entries: [{ attributeModifier: 5, showPercent: true, valueFormat: '{value:0.0%}' }] }],
    [60, { name: 'Ether reduction', entries: [{ attributeModifier: 9, showPercent: true, valueFormat: '{1-value:0.0%}' }] }],
  ])
  const result = buildPotentialStats({
    dataList: [
      { attrModifier: { attrType: 39, attrValue: 15, modifierType: 5 } },
      { attrModifier: { attrType: 50, attrValue: 0.08, modifierType: 5 } },
      { attrModifier: { attrType: 60, attrValue: -0.1, modifierType: 5 } },
      { attrModifier: { attrType: 0, attrValue: 0, modifierType: 0 } },
    ],
  }, { attrTypeMap, compositeCfg: new Map() })

  expect(result).toEqual([
    { attributeId: '39', value: 15, isPercent: false },
    { attributeId: '50', value: 0.08, isPercent: true },
    { attributeId: '60', value: -0.1, isPercent: true },
  ])
})

it('maps farmable dungeon categories to resource + SS only', () => {
  expect(PLANNER_FARMABLE_DUNGEON_CATEGORIES.has('dungeon_resource')).toBe(true)
  expect(PLANNER_FARMABLE_DUNGEON_CATEGORIES.has('dungeon_ss')).toBe(true)
  expect(PLANNER_FARMABLE_DUNGEON_CATEGORIES.has('dungeon_bossrush')).toBe(false)
})

type SuitEffect = Parameters<typeof staticSetValues>[0]

function suitEffect(zhFirstLine: string, values: Record<string, number>): SuitEffect {
  const text = { 'zh-CN': `${zhFirstLine}\n条件效果: 生命值高于80%时生效。`, en: '', ja: '', 'zh-TW': '' }
  return { id: 'passive_test_01', name: text, description: text, requiredPieces: 3, values }
}

it('keeps only set-effect values whose label is stated in the first sentence', () => {
  // 生命值+500 是生命值上限加成, hp_add=100 是「击败敌人后回复100点生命值」的回复量。
  expect(staticSetValues(suitEffect('3件套组效果: 装备者生命值+500。', { hp_up: 500, hp_add: 100, cd: 5 }))).toEqual({ hp_up: 500 })
  // 首句没提攻击力时不能把同名黑名字段当成攻击力加成。
  expect(staticSetValues(suitEffect('3件套组效果: 装备者所有技能伤害+24%。', { atk_up: 0.05, skill_dmg_up: 0.2 }))).toEqual({})
  expect(staticSetValues(suitEffect('3件套组效果: 装备者防御力+50。', { def_up: 50, dmg_taken_down: 0.7 }))).toEqual({ def_up: 50 })
})

it('uses fixed client counts and SS server override of 6 for zero-count bundles', () => {
  expect(PLANNER_SS_SERVER_YIELD_PER_RUN).toBe(6)
  expect(resolveFarmYieldCount(17)).toBe(17)
  expect(resolveFarmYieldCount(0)).toBeNull()
  expect(resolveFarmYieldCount(0, PLANNER_SS_SERVER_YIELD_PER_RUN)).toBe(6)
  expect(resolveFarmYieldCount(-1, PLANNER_SS_SERVER_YIELD_PER_RUN)).toBeNull()
})
