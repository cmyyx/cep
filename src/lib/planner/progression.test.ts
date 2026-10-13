import { describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import {
  calculateGrowthRequirements,
  calculatePanelStats,
  createDefaultGrowthConfig,
  estimateFarming,
  migrateLegacySkillLevelOrder,
  normalizeGrowthConfig,
} from './progression'
import { loadPlannerData, resetPlannerDataCacheForTests, setPlannerDataImporterForTests } from './planner-data-loader'
import type { PanelPreviewConfig } from '@/types/planner'

// Progression reads planner data from the loader cache; prime it up front the
// same way the gated pages do.
await loadPlannerData()

const characterId = Object.keys(plannerGameData.characters)[0]
const weaponId = Object.keys(plannerGameData.weapons)[0]


function emptyEquipment() {
  return { equipmentId: null, statLevels: [] }
}

/** Equipment selection with every affix at its max refinement level. */
function maxedEquipment(equipmentId: string) {
  return { equipmentId, statLevels: plannerGameData.equipment[equipmentId].map((stat) => stat.values.length - 1) }
}

/** Full-progression baseline (max level / nodes / potential); only gear differs per test. */
function maxedPanelConfig(characterId: string, overrides: Partial<PanelPreviewConfig> = {}): PanelPreviewConfig {
  const character = plannerGameData.characters[characterId]
  return {
    characterId,
    level: 90,
    skillLevels: character.skills.map((skill) => skill.maxLevel),
    talentCount: character.talents.length,
    potentialLevel: character.potentials.at(-1)?.level ?? 0,
    attributeNodeCount: character.attributeNodes.length,
    weaponId: null,
    weaponLevel: 90,
    weaponSkillLevels: [1, 1, 1],
    armor: emptyEquipment(),
    gloves: emptyEquipment(),
    accessoryOne: emptyEquipment(),
    accessoryTwo: emptyEquipment(),
    ...overrides,
  }
}


describe('planner generated data', () => {
  it('includes EXP conversion values and parent stage metadata', () => {
    expect(plannerGameData.materials.item_expcard_stage1_high?.expValue).toBe(10_000)
    expect(plannerGameData.materials.item_expcard_stage2_high?.expValue).toBe(10_000)

    const goldStage = plannerGameData.dungeons.find((dungeon) => dungeon.seriesId === 'dung01_group_gold01')
    expect(goldStage?.id).toBe('dung01_gold05')
    expect(goldStage?.stamina).toBeGreaterThan(0)
  })

  it('stays slim: no localized name payloads, zh-CN-only weapon skill descriptions', () => {
    // Display names come from the game-i18n catalogs, not planner data.
    const material = Object.values(plannerGameData.materials)[0] as unknown as Record<string, unknown>
    expect(material.name).toBeUndefined()
    const dungeon = plannerGameData.dungeons[0] as unknown as Record<string, unknown>
    expect(dungeon.name).toBeUndefined()
    expect(dungeon.seriesName).toBeUndefined()

    const weapon = Object.values(plannerGameData.weapons).find((entry) => entry.skills.some((skill) => skill.levels.length > 0))
    const level = weapon?.skills[0]?.levels[0]
    expect(typeof level?.description).toBe('string')
  })
})

describe('migrateLegacySkillLevelOrder', () => {
  it('swaps ultimate and combo slots for length-4 skill arrays', () => {
    expect(migrateLegacySkillLevelOrder([1, 2, 3, 4])).toEqual([1, 2, 4, 3])
  })

  it('leaves shorter arrays and non-arrays alone', () => {
    expect(migrateLegacySkillLevelOrder([1, 2, 3])).toEqual([1, 2, 3])
    expect(migrateLegacySkillLevelOrder(undefined)).toBeUndefined()
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

  it('maps skill specialize materials to SS stages at 6 per run and ignores bossrush', () => {
    const estimate = estimateFarming({
      materials: [{ itemId: 'item_char_skill_specialize_2', count: 13 }],
      stageOneExp: 0,
      stageTwoExp: 0,
      weaponExp: 0,
      gold: 0,
    })
    expect(estimate.stages).toHaveLength(1)
    expect(estimate.stages[0].dungeon.id).toBe('dung_ss02')
    expect(estimate.stages[0].dungeon.seriesId).toBe('dung_group_ss02')
    expect(estimate.stages[0].dungeon.yields.find(([itemId]) => itemId === 'item_char_skill_specialize_2')?.[1]).toBe(6)
    expect(estimate.stages[0].runs).toBe(3)
    expect(estimate.stages[0].stamina).toBe(240)
    expect(plannerGameData.dungeons.some((dungeon) => dungeon.id.includes('bossrush'))).toBe(false)
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
      potentialLevel: character.potentials.at(-1)?.level ?? 0,
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
  it('applies fixed character potential stats to the panel', () => {
    const characterId = 'chr_0018_dapan'
    const character = plannerGameData.characters[characterId]
    const base: PanelPreviewConfig = {
      characterId,
      level: 90,
      skillLevels: character.skills.map((skill) => skill.maxLevel),
      talentCount: character.talents.length,
      potentialLevel: 0,
      attributeNodeCount: character.attributeNodes.length,
      weaponId: null,
      weaponLevel: 90,
      weaponSkillLevels: [1, 1, 1],
      armor: emptyEquipment(),
      gloves: emptyEquipment(),
      accessoryOne: emptyEquipment(),
      accessoryTwo: emptyEquipment(),
    }
    const withoutPotential = calculatePanelStats(base)
    const withPotential = calculatePanelStats({ ...base, potentialLevel: 3 })
    expect(withPotential.strength - withoutPotential.strength).toBe(15)
    expect(withPotential.modifiers).toEqual(expect.arrayContaining([expect.objectContaining({ id: '50', value: 8, isPercent: true })]))
  })
  it('returns empty panel stats for an unknown character', () => {
    const config: PanelPreviewConfig = {
      characterId: 'missing',
      level: 1,
      skillLevels: [],
      talentCount: 0,
      potentialLevel: 0,
      attributeNodeCount: 0,
      weaponId: null,
      weaponLevel: 1,
      weaponSkillLevels: [],
      armor: emptyEquipment(),
      gloves: emptyEquipment(),
      accessoryOne: emptyEquipment(),
      accessoryTwo: emptyEquipment(),
    }
    expect(calculatePanelStats(config)).toEqual({ strength: 0, agility: 0, intellect: 0, will: 0, hp: 0, defense: 0, attack: 0, modifiers: [], attributeContributions: [], setEffects: [] })
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
      potentialLevel: character.potentials.at(-1)?.level ?? 0,
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
      potentialLevel: character.potentials.at(-1)?.level ?? 0,
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
      potentialLevel: character.potentials.at(-1)?.level ?? 0,
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
      potentialLevel: character.potentials.at(-1)?.level ?? 0,
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

  /**
   * 游戏口径: 力量换算的生命走 ModifierType.BaseAdd (Attributes.GetHpBaseAddFromStrAttribute),
   * 装备/套装/武器的「最大生命值+X%」走 ModifierType.BaseMultiplier, 结算次序是
   * `(raw + baseAdd) × (1 + baseMultiplier)`。力量换算若在百分比之后相加 (旧实现),
   * 高生命%配装会系统性偏低。
   */
  it('applies 最大生命值% to the strength-derived HP', () => {
    // 余烬 L90 基础生命 5495; 大雷斑 L9 二技能 = 最大生命值 +78%
    const config = maxedPanelConfig('chr_0009_azrila', { weaponId: 'wpn_claym_0007', weaponSkillLevels: [9, 9, 9] })
    const stats = calculatePanelStats(config)
    const strengthHp = Math.floor(stats.strength) * plannerGameData.derivedAttributes.efficiencyOfSTR

    expect(stats.hp).toBeCloseTo((5495 + strengthHp) * 1.78, 6)
  })

  it('multiplies strength-derived HP and the whole flat HP pool by 最大生命值%', () => {
    // 余烬 + 大雷斑 + 生物辅助 4 件 (胸甲/手甲/接驳器·贰型/接驳器·壹型); 游戏内约 25323 (旧实现 19068)。
    const config = maxedPanelConfig('chr_0009_azrila', {
      weaponId: 'wpn_claym_0007',
      weaponSkillLevels: [9, 9, 9],
      armor: maxedEquipment('item_equip_t4_suit_heal01_body_01'),
      gloves: maxedEquipment('item_equip_t4_suit_heal01_hand_02'),
      accessoryOne: maxedEquipment('item_equip_t4_suit_heal01_edc_02'),
      accessoryTwo: maxedEquipment('item_equip_t4_suit_heal01_edc_05'),
    })
    const stats = calculatePanelStats(config)
    const strengthHp = Math.floor(stats.strength) * plannerGameData.derivedAttributes.efficiencyOfSTR
    const hpPercent = 0.78 + 0.5382 + 0.5382

    expect(stats.hp).toBeCloseTo((5495 + strengthHp) * (1 + hpPercent), 6)
  })

  /**
   * 四维取整数部分 (游戏内实测, 见 progression.ts 的 integerPart 注释):
   * 面板显示 695 力量时「力量提供的生命值」= 3475 = 5×695, 而不是 5×695.41174 = 3477.06。
   * 余烬 L90 基础力量自带小数 (176.41174) 且其余力量来源全为整数, 所以任何不含
   * 「主能力+/力量+%」的配装真值都是 X.41174 —— 贡献值必须等于 5×floor(X)。
   */
  it('uses only the integer part of the four attributes in derived formulas', () => {
    const config = maxedPanelConfig('chr_0009_azrila', { weaponId: 'wpn_claym_0007', weaponSkillLevels: [9, 9, 9] })
    const stats = calculatePanelStats(config)
    const strengthHp = stats.attributeContributions.find((entry) => entry.source === 'strength' && entry.target === 'hp')
    const strengthAttack = stats.attributeContributions.find((entry) => entry.source === 'strength' && entry.target === 'attack')

    expect(stats.strength).toBeCloseTo(412.41174, 5)
    expect(strengthHp?.value).toBe(5 * 412)
    expect(strengthHp?.value).toBeLessThan(5 * stats.strength)
    expect(strengthAttack?.value).toBeCloseTo(412 * 0.005 * 100, 6)
  })

  it('derives physical/spell resistance from the reciprocal curve, not a linear one', () => {
    // 敏捷/智识提供的是「抗性点数」: 1 - 1/(1 + efficiency×属性)。
    // 线性写法 (属性×efficiency×100) 会高估减免: 96.95876 敏捷 → 9.6959% vs 正确 8.7591%。
    const stats = calculatePanelStats(maxedPanelConfig('chr_0009_azrila'))
    const agility = Math.floor(stats.agility)
    const intellect = Math.floor(stats.intellect)
    const physical = stats.attributeContributions.find((entry) => entry.source === 'agility' && entry.target === 'physicalDamageReduction')
    const spell = stats.attributeContributions.find((entry) => entry.source === 'intellect' && entry.target === 'fireDamageReduction')

    expect(agility).toBe(96)
    expect(physical?.value).toBeCloseTo((1 - 1 / (1 + 0.001 * agility)) * 100, 6)
    expect(physical?.value).not.toBeCloseTo(agility * 0.001 * 100, 6)
    expect(spell?.value).toBeCloseTo((1 - 1 / (1 + 0.001 * intellect)) * 100, 6)
  })

  /**
   * ModifierType 7 (BaseFinalAddition) 必须在基值乘算**之后**相加。
   *
   * 上游 EquipTable 里测试型重甲 (t1 tundra01 胸甲) 的生命值+125.37639386 就是 7;
   * 已提交的 planner 数据还没有这个字段 (要等下一次上游同步), 所以这里临时把该词条
   * 标成 7, 用假装载器跑一遍真实代码路径。
   */
  it('adds ModifierType 7 affixes after the base multiplier', async () => {
    const armorId = 'item_equip_t1_parts_tundra01_body_01'
    const armorStats = plannerGameData.equipment[armorId]
    const hpAffix = armorStats.find((stat) => stat.attributeId === '1')
    if (!hpAffix) throw new Error('Expected a MaxHp affix on the test armor')
    const hpAffixValue = hpAffix.values.at(-1) ?? 0
    const baseHp = plannerGameData.characters['chr_0009_azrila'].levels.at(-1)?.stats.find((stat) => stat.attributeId === '1')?.value ?? 0

    // 生成数据现在总是带 modifierType, 所以旧数据要真的把字段删掉 (而不是传 undefined 不覆盖)
    const panelFor = async (modifierType: number | null) => {
      const equipment = {
        ...plannerGameData.equipment,
        [armorId]: armorStats.map((stat) => {
          if (stat.attributeId !== '1') return stat
          if (modifierType === null) {
            const legacy: { attributeId: string; values: number[]; displayValues?: string[]; modifierType?: number } = { ...stat }
            delete legacy.modifierType
            return legacy
          }
          return { ...stat, modifierType }
        }),
      }
      resetPlannerDataCacheForTests()
      setPlannerDataImporterForTests(async () => ({
        plannerGameData: { ...plannerGameData, equipment },
        wikiCharacters: [],
        wikiWeapons: [],
      }))
      await loadPlannerData()
      return calculatePanelStats(maxedPanelConfig('chr_0009_azrila', { weaponId: 'wpn_claym_0007', weaponSkillLevels: [9, 9, 9], armor: maxedEquipment(armorId) }))
    }

    try {
      const withPool = await panelFor(7)
      const withoutField = await panelFor(null)
      const strengthHp = Math.floor(withPool.strength) * plannerGameData.derivedAttributes.efficiencyOfSTR

      // 大雷斑 L9 = 最大生命值 +78%; 7 的固定值在 ×1.78 之后相加
      expect(withPool.hp).toBeCloseTo((baseHp + strengthHp) * 1.78 + hpAffixValue, 6)
      // 旧数据 (无 modifierType) = 普通固定值: 会被 ×1.78 放大
      expect(withoutField.hp).toBeCloseTo((baseHp + hpAffixValue + strengthHp) * 1.78, 6)
      expect(withoutField.hp).toBeGreaterThan(withPool.hp)
    } finally {
      resetPlannerDataCacheForTests()
      await loadPlannerData()
    }
  })

  /**
   * 四维/生命等按上游 `AttributeMetaTable` 钳制 (旧数据无该字段则不钳制), 与 ModifierType 7 同样
   * 用假装载器注入: 已提交数据现在两个字段都有, 注入是为了单独覆盖"旧数据/限值不同"的兼容分支。
   */
  it('clamps each base pool to the upstream attribute limits', async () => {
    const armorId = 'item_equip_t1_parts_tundra01_body_01'
    const panelFor = async (limits: Record<string, { min?: number; max?: number }> | undefined) => {
      resetPlannerDataCacheForTests()
      setPlannerDataImporterForTests(async () => ({
        plannerGameData: { ...plannerGameData, attributeLimits: limits },
        wikiCharacters: [],
        wikiWeapons: [],
      }))
      await loadPlannerData()
      return calculatePanelStats(maxedPanelConfig('chr_0009_azrila', { weaponId: 'wpn_claym_0007', weaponSkillLevels: [9, 9, 9], armor: maxedEquipment(armorId) }))
    }

    try {
      // 旧数据 (无 attributeLimits) 不做任何钳制
      const unlimited = await panelFor(undefined)
      // 力量上限压到 300: 池内先加固定值再乘 (1+%) 后钳制到 300
      const maxed = await panelFor({ '39': { min: 0, max: 300 } })
      // 生命上限压到 10000: 末尾 Clamp 生效
      const hpCapped = await panelFor({ '1': { max: 10000 } })
      // 生命下限抬到 99999: 先抬到下限再乘 (1+78%), 所以最终会更高
      const hpFloored = await panelFor({ '1': { min: 99999 } })

      expect(unlimited.strength).toBeGreaterThan(300)
      expect(maxed.strength).toBe(300)
      expect(hpCapped.hp).toBe(10000)
      expect(unlimited.hp).toBeGreaterThan(10000)
      expect(hpFloored.hp).toBeGreaterThanOrEqual(99999)
    } finally {
      resetPlannerDataCacheForTests()
      await loadPlannerData()
    }
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
      potentialLevel: character.potentials.at(-1)?.level ?? 0,
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
