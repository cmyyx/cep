import { expect, it } from 'vitest'
import {
  formatWikiNumber,
  formatWikiStatText,
  groupCharacterLogisticsSkills,
  packCharacterLevels,
  packSkillLevels,
  packWeaponLevels,
  unpackCharacterLevels,
  unpackSkillLevels,
  unpackWeaponLevels,
} from './wiki-detail-utils'

it('caps displayed precision at two decimals without padding integers', () => {
  expect(formatWikiNumber(91.85567)).toBe('91.86')
  expect(formatWikiNumber(1.45408)).toBe('1.45')
  expect(formatWikiNumber(46.32737219)).toBe('46.33')
  expect(formatWikiNumber(640)).toBe('640')
  expect(formatWikiNumber(6.6)).toBe('6.6')
  // toFixed(2) 会补零, 显示层必须去掉尾随零
  expect(formatWikiNumber(1.001)).toBe('1')
  expect(formatWikiNumber(-3.14159)).toBe('-3.14')
  expect(formatWikiNumber(Number.NaN)).toBe('NaN')
})

it('formats only the numeric prefix of equipment stat values', () => {
  expect(formatWikiStatText('46.32737219')).toBe('46.33')
  expect(formatWikiStatText('6.6%')).toBe('6.6%')
  expect(formatWikiStatText('13.80712%')).toBe('13.81%')
  expect(formatWikiStatText('—')).toBe('—')
  expect(formatWikiStatText('')).toBe('')
})

it('character levels round-trip losslessly and drop fields islands never read', () => {
  const levels = [
    {
      level: 1,
      breakStage: 0,
      isBreakthrough: false,
      stats: [
        { attributeId: '1', value: 55.12345 },
        { attributeId: '2', value: 10 },
      ],
    },
    {
      level: 90,
      breakStage: 3,
      isBreakthrough: true,
      stats: [{ attributeId: '1', value: 987.00255 }],
    },
  ]

  const packed = packCharacterLevels(levels)
  expect(packed.statKeys).toEqual(['1', '2'])
  expect(packed.rows).toEqual([
    [1, 0, 55.12345, 10],
    [90, 3, 987.00255, null],
  ])

  const unpacked = unpackCharacterLevels(packed)
  expect(unpacked).toEqual([
    { level: 1, breakStage: 0, stats: levels[0].stats },
    { level: 90, breakStage: 3, stats: levels[1].stats },
  ])
})

it('weapon levels round-trip losslessly', () => {
  const levels = [
    { level: 1, baseAttack: 51 },
    { level: 90, baseAttack: 640 },
  ]
  expect(unpackWeaponLevels(packWeaponLevels(levels))).toEqual(levels)
})

it('skill levels round-trip preserving optional coolDown/cost and material refs', () => {
  const levels = [
    {
      level: 1,
      label: 'Lv.1',
      values: ['100%', '2'],
      coolDown: 12,
      materials: [{ itemId: 'mat-a', count: 3 }],
    },
    {
      level: 12,
      label: 'M3',
      values: ['240%', '3'],
      costValue: 25,
    },
  ]

  const unpacked = unpackSkillLevels(packSkillLevels(levels))
  expect(unpacked).toEqual([
    {
      level: 1,
      label: 'Lv.1',
      values: ['100%', '2'],
      coolDown: 12,
      costValue: undefined,
      materials: [{ itemId: 'mat-a', count: 3 }],
    },
    {
      level: 12,
      label: 'M3',
      values: ['240%', '3'],
      coolDown: undefined,
      costValue: 25,
      materials: [],
    },
  ])
})

// 上游实测结构 (chr_0032_lizhiyan 等 28 个干员一致): 2 个后勤位 x 2 个档位 (β/γ),
// 材料节点按 (index, level) 一一对应, breakStage 交错为 1/3 与 2/4。
const logisticsSkills = [
  { id: 'slot0-beta', index: 0, level: 1, iconId: 'mineral' },
  { id: 'slot0-gamma', index: 0, level: 2, iconId: 'mineral' },
  { id: 'slot1-beta', index: 1, level: 1, iconId: 'flower' },
  { id: 'slot1-gamma', index: 1, level: 2, iconId: 'flower' },
]
const logisticsNodes = [
  { id: 'node-0-1', index: 0, level: 1, breakStage: 1 },
  { id: 'node-1-1', index: 1, level: 1, breakStage: 2 },
  { id: 'node-0-2', index: 0, level: 2, breakStage: 3 },
  { id: 'node-1-2', index: 1, level: 2, breakStage: 4 },
]

it('keeps every logistics tier instead of collapsing a slot to its first skill', () => {
  const groups = groupCharacterLogisticsSkills(logisticsSkills, logisticsNodes)

  expect(groups.map((group) => group.index)).toEqual([0, 1])
  expect(groups.map((group) => group.iconId)).toEqual(['mineral', 'flower'])
  expect(groups.map((group) => group.tiers.map((tier) => tier.skill.id))).toEqual([
    ['slot0-beta', 'slot0-gamma'],
    ['slot1-beta', 'slot1-gamma'],
  ])
})

it('pairs upgrade materials by slot AND tier so γ never inherits the β cost', () => {
  const groups = groupCharacterLogisticsSkills(logisticsSkills, logisticsNodes)

  expect(groups.map((group) => group.tiers.map((tier) => tier.node?.id))).toEqual([
    ['node-0-1', 'node-0-2'],
    ['node-1-1', 'node-1-2'],
  ])
})

it('sorts slots and tiers independently of the upstream array order', () => {
  const shuffled = [logisticsSkills[3], logisticsSkills[1], logisticsSkills[2], logisticsSkills[0]]

  expect(groupCharacterLogisticsSkills(shuffled, logisticsNodes).map((group) => group.tiers.map((tier) => tier.skill.level)))
    .toEqual([[1, 2], [1, 2]])
})

it('tolerates slots without a material node, odd tier counts and no logistics at all', () => {
  const [single] = groupCharacterLogisticsSkills([{ id: 'lone', index: 3, level: 1 }], [])
  expect(single.tiers).toEqual([{ skill: { id: 'lone', index: 3, level: 1 }, node: undefined }])
  expect(single.iconId).toBeUndefined()

  const threeTiers = groupCharacterLogisticsSkills(
    [
      { id: 'a', index: 0, level: 3 },
      { id: 'b', index: 0, level: 1 },
      { id: 'c', index: 0, level: 2 },
    ],
    [{ id: 'node-0-3', index: 0, level: 3 }],
  )
  expect(threeTiers[0].tiers.map((tier) => [tier.skill.id, tier.node?.id])).toEqual([
    ['b', undefined],
    ['c', undefined],
    ['a', 'node-0-3'],
  ])

  expect(groupCharacterLogisticsSkills([], logisticsNodes)).toEqual([])
})
