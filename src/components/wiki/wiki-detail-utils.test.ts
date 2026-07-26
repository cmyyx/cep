import { expect, it } from 'vitest'
import {
  packCharacterLevels,
  packSkillLevels,
  packWeaponLevels,
  unpackCharacterLevels,
  unpackSkillLevels,
  unpackWeaponLevels,
} from './wiki-detail-utils'

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
