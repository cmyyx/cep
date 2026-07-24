import { expect, it } from 'vitest'
import {
  buildPotentialStats,
  PLANNER_FARMABLE_DUNGEON_CATEGORIES,
  PLANNER_SS_SERVER_YIELD_PER_RUN,
  resolveFarmYieldCount,
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

it('uses fixed client counts and SS server override of 6 for zero-count bundles', () => {
  expect(PLANNER_SS_SERVER_YIELD_PER_RUN).toBe(6)
  expect(resolveFarmYieldCount(17)).toBe(17)
  expect(resolveFarmYieldCount(0)).toBeNull()
  expect(resolveFarmYieldCount(0, PLANNER_SS_SERVER_YIELD_PER_RUN)).toBe(6)
  expect(resolveFarmYieldCount(-1, PLANNER_SS_SERVER_YIELD_PER_RUN)).toBeNull()
})
