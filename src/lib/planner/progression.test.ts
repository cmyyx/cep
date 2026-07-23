import { describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import {
  calculateGrowthRequirements,
  calculatePanelStats,
  createDefaultGrowthConfig,
  estimateFarming,
  normalizeGrowthConfig,
} from './progression'
import type { PanelPreviewConfig } from '@/types/planner'
const characterId = Object.keys(plannerGameData.characters)[0]
const weaponId = Object.keys(plannerGameData.weapons)[0]


function emptyEquipment() {
  return { equipmentId: null, statLevels: [] }
}


describe('planner generated data', () => {
  it('preserves int64 text IDs when resolving resource and dungeon names', () => {
    const resourceIds = ['item_expcard_stage1_high', 'item_expcard_stage2_high', 'item_weapon_expcard_high', 'item_gold']
    const names = [
      ...resourceIds.map((id) => plannerGameData.materials[id]?.name['zh-CN']),
      ...plannerGameData.dungeons.map((dungeon) => dungeon.name['zh-CN']),
    ]

    expect(names.every((name) => name !== undefined && !/^-?\d+$/.test(name))).toBe(true)
  })

  it('includes EXP conversion values and parent stage metadata', () => {
    expect(plannerGameData.materials.item_expcard_stage1_high?.expValue).toBe(10_000)
    expect(plannerGameData.materials.item_expcard_stage2_high?.expValue).toBe(10_000)

    const goldStage = plannerGameData.dungeons.find((dungeon) => dungeon.seriesId === 'dung01_group_gold01')
    expect(goldStage?.seriesName['zh-CN']).toBe('协议空间·钱币收集')
    expect(goldStage?.name['zh-CN']).toBe('金币之祝')
  })
})
describe('growth progression', () => {
  it('defaults characters and weapons from minimum progress to maximum targets', () => {
    const character = createDefaultGrowthConfig('character', characterId)
    const weapon = createDefaultGrowthConfig('weapon', weaponId)

    expect(character.currentLevel).toBe(1)
    expect(character.targetLevel).toBe(90)
    expect(character.kind === 'character' && character.currentSkillLevels.every((level) => level === 1)).toBe(true)
    expect(weapon.currentLevel).toBe(1)
    expect(weapon.targetLevel).toBe(90)
  })

  it('normalizes targets so they never precede current progress', () => {
    const config = createDefaultGrowthConfig('character', characterId)
    if (config.kind !== 'character') throw new Error('Expected character config')

    const normalized = normalizeGrowthConfig({
      ...config,
      currentLevel: 70,
      targetLevel: 20,
      currentSkillLevels: config.currentSkillLevels.map(() => 5),
      targetSkillLevels: config.targetSkillLevels.map(() => 1),
    })

    expect(normalized.targetLevel).toBe(70)
    expect(normalized.kind === 'character' && normalized.targetSkillLevels.every((level) => level >= 5)).toBe(true)
  })

  it('uses separate character EXP pools across the level 60 boundary', () => {
    const config = createDefaultGrowthConfig('character', characterId)
    if (config.kind !== 'character') throw new Error('Expected character config')
    const noNodes = {
      ...config,
      currentLevel: 59,
      targetLevel: 61,
      currentBreakStage: config.targetBreakStage,
      currentSkillLevels: config.targetSkillLevels,
      currentTalentIds: config.targetTalentIds,
      currentAttributeNodeIds: config.targetAttributeNodeIds,
      currentEquipmentNodeIds: config.targetEquipmentNodeIds,
      currentLogisticsNodeIds: config.targetLogisticsNodeIds,
    }
    const result = calculateGrowthRequirements([noNodes])

    expect(result.stageOneExp).toBeGreaterThan(0)
    expect(result.stageTwoExp).toBeGreaterThan(0)
  })

  it('converts exact highest-stage yields into runs and stamina', () => {
    const estimate = estimateFarming({
      materials: [],
      stageOneExp: 170_001,
      stageTwoExp: 68_001,
      weaponExp: 170_001,
      gold: 34_001,
    })
    expect(estimate.stages).toHaveLength(4)
    expect(estimate.totalRuns).toBe(8)
    expect(estimate.totalStamina).toBe(640)
  })

  it('maps fixed skill materials to the highest resource stage', () => {
    const estimate = estimateFarming({ materials: [{ itemId: 'item_char_skill_level_7_12', count: 18 }], stageOneExp: 0, stageTwoExp: 0, weaponExp: 0, gold: 0 })
    expect(estimate.stages).toHaveLength(1)
    expect(estimate.stages[0].dungeon.id).toBe('dung01_skill05')
    expect(estimate.stages[0].runs).toBe(2)
    expect(estimate.totalStamina).toBe(160)
  })
})

describe('panel preview', () => {
  it('changes the calculated panel when character level changes', () => {
    const character = plannerGameData.characters[characterId]
    const base: PanelPreviewConfig = {
      characterId,
      level: 1,
      skillLevels: character.skills.map((skill) => skill.maxLevel),
      talentCount: character.talents.length,
      attributeNodeCount: character.attributeNodes.length,
      weaponId: null,
      weaponLevel: 90,
      weaponSkillLevels: [9, 9, 9],
      armor: emptyEquipment(),
      gloves: emptyEquipment(),
      accessoryOne: emptyEquipment(),
      accessoryTwo: emptyEquipment(),
    }

    const levelOne = calculatePanelStats(base)
    const levelMax = calculatePanelStats({ ...base, level: 90 })

    expect(levelMax.hp).toBeGreaterThan(levelOne.hp)
    expect(levelMax.attack).toBeGreaterThan(levelOne.attack)
  })

  it('keeps attribute contributions separate from weapon and equipment modifiers', () => {
    const character = plannerGameData.characters[characterId]
    const equipmentEntry = Object.entries(plannerGameData.equipment).find(([, stats]) => stats.some((stat) => stat.attributeId === '3' && (stat.values[0] ?? 0) > 0))
    if (!equipmentEntry) throw new Error('Expected equipment with defense')
    const [equipmentId, equipmentStats] = equipmentEntry
    const config: PanelPreviewConfig = {
      characterId,
      level: 90,
      skillLevels: character.skills.map((skill) => skill.maxLevel),
      talentCount: character.talents.length,
      attributeNodeCount: character.attributeNodes.length,
      weaponId: null,
      weaponLevel: 90,
      weaponSkillLevels: [1, 1, 1],
      armor: { equipmentId, statLevels: equipmentStats.map(() => 0) },
      gloves: emptyEquipment(),
      accessoryOne: emptyEquipment(),
      accessoryTwo: emptyEquipment(),
    }
    const stats = calculatePanelStats(config)

    expect(stats.modifiers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'PhysicalDamageTakenScalar' }),
      expect.objectContaining({ id: 'DefenseDamageTakenScalar' }),
    ]))
    expect(stats.attributeContributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'agility', target: 'physicalDamageReduction', isPercent: true }),
      expect.objectContaining({ source: 'defense', target: 'defenseDamageReduction', isPercent: true }),
    ]))
  })

  it('adds selected weapon base attack to the panel', () => {
    const character = plannerGameData.characters[characterId]
    const base: PanelPreviewConfig = {
      characterId,
      level: 90,
      skillLevels: character.skills.map((skill) => skill.maxLevel),
      talentCount: character.talents.length,
      attributeNodeCount: character.attributeNodes.length,
      weaponId: null,
      weaponLevel: 90,
      weaponSkillLevels: [1, 1, 1],
      armor: emptyEquipment(),
      gloves: emptyEquipment(),
      accessoryOne: emptyEquipment(),
      accessoryTwo: emptyEquipment(),
    }
    const withoutWeapon = calculatePanelStats(base)
    const withWeapon = calculatePanelStats({ ...base, weaponId })
    expect(withWeapon.attack).toBeGreaterThan(withoutWeapon.attack)
  })

  it('applies each equipment affix at its independently selected level', () => {
    const character = plannerGameData.characters[characterId]
    const equipmentEntry = Object.entries(plannerGameData.equipment).find(([, stats]) => stats.some((stat) => (stat.values.at(-1) ?? 0) !== (stat.values[0] ?? 0)))
    if (!equipmentEntry) throw new Error('Expected equipment with scaling affixes')
    const [equipmentId, equipmentStats] = equipmentEntry
    const base: PanelPreviewConfig = {
      characterId,
      level: 90,
      skillLevels: character.skills.map((skill) => skill.maxLevel),
      talentCount: character.talents.length,
      attributeNodeCount: character.attributeNodes.length,
      weaponId: null,
      weaponLevel: 90,
      weaponSkillLevels: [1, 1, 1],
      armor: { equipmentId, statLevels: equipmentStats.map(() => 0) },
      gloves: emptyEquipment(),
      accessoryOne: emptyEquipment(),
      accessoryTwo: emptyEquipment(),
    }
    const low = calculatePanelStats(base)
    const high = calculatePanelStats({ ...base, armor: { equipmentId, statLevels: equipmentStats.map((stat) => stat.values.length - 1) } })
    expect(high).not.toEqual(low)
  })

  it('adds fixed equipment defense to the core defense stat', () => {
    const character = plannerGameData.characters[characterId]
    const equipmentEntry = Object.entries(plannerGameData.equipment).find(([, stats]) => stats.some((stat) => stat.attributeId === '3' && (stat.values[0] ?? 0) > 0))
    if (!equipmentEntry) throw new Error('Expected equipment with defense')
    const [equipmentId, equipmentStats] = equipmentEntry
    const base: PanelPreviewConfig = {
      characterId,
      level: 90,
      skillLevels: character.skills.map((skill) => skill.maxLevel),
      talentCount: character.talents.length,
      attributeNodeCount: character.attributeNodes.length,
      weaponId: null,
      weaponLevel: 90,
      weaponSkillLevels: [1, 1, 1],
      armor: emptyEquipment(),
      gloves: emptyEquipment(),
      accessoryOne: emptyEquipment(),
      accessoryTwo: emptyEquipment(),
    }
    const withoutEquipment = calculatePanelStats(base)
    const withEquipment = calculatePanelStats({ ...base, armor: { equipmentId, statLevels: equipmentStats.map(() => 0) } })

    expect(withEquipment.defense).toBeGreaterThan(withoutEquipment.defense)
  })

  it('applies static set stats only after the piece requirement is met', () => {
    const character = plannerGameData.characters[characterId]
    const armorId = 'item_equip_t2_suit_agi01_body_01'
    const glovesId = 'item_equip_t2_suit_agi01_hand_01'
    const accessoryId = 'item_equip_t3_suit_agi01_edc_03'
    const selected = (equipmentId: string) => ({ equipmentId, statLevels: plannerGameData.equipment[equipmentId].map(() => 0) })
    const base: PanelPreviewConfig = {
      characterId,
      level: 90,
      skillLevels: character.skills.map((skill) => skill.maxLevel),
      talentCount: character.talents.length,
      attributeNodeCount: character.attributeNodes.length,
      weaponId: null,
      weaponLevel: 90,
      weaponSkillLevels: [1, 1, 1],
      armor: selected(armorId),
      gloves: selected(glovesId),
      accessoryOne: selected(accessoryId),
      accessoryTwo: emptyEquipment(),
    }
    const twoPieces = calculatePanelStats({ ...base, accessoryOne: emptyEquipment() })
    const threePieces = calculatePanelStats(base)
    const accessoryAgility = plannerGameData.equipment[accessoryId].find((stat) => stat.attributeId === '40')?.values[0] ?? 0

    expect(twoPieces.setEffects).toEqual([])
    expect(threePieces.setEffects).toEqual([expect.objectContaining({ id: 'passive_equipsuit_agi_01', requiredPieces: 3, pieceCount: 3 })])
    expect(threePieces.agility - twoPieces.agility - accessoryAgility).toBe(50)
  })
})
