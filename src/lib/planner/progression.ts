import { plannerGameData } from '@/generated/data/planner'
import { PLANNER_RESOURCE_IDS } from '@/lib/planner-resource-ids'
import type {
  FarmingEstimate,
  GrowthCalculationResult,
  GrowthConfig,
  MaterialRequirement,
  PanelAttributeContribution,
  PanelPreviewConfig,
  PanelStatModifier,
  PanelStats,
  PlannerCharacterData,
  PlannerEquipmentStatData,
  PlannerGameData,
  PlannerMaterialTuple,
} from '@/types/planner'

const { gold: GOLD_ID, stageOneExp: STAGE_ONE_EXP_ID, stageTwoExp: STAGE_TWO_EXP_ID, weaponExp: WEAPON_EXP_ID } = PLANNER_RESOURCE_IDS

type CorePanelStatKey = keyof Pick<PanelStats, 'strength' | 'agility' | 'intellect' | 'will' | 'hp' | 'defense' | 'attack'>

const CORE_ATTRIBUTE_IDS = {
  strength: '39',
  agility: '40',
  intellect: '41',
  will: '42',
  hp: '1',
  defense: '3',
  attack: '2',
} as const
const CORE_KEY_BY_ID: Record<string, CorePanelStatKey> = {
  '39': 'strength',
  '40': 'agility',
  '41': 'intellect',
  '42': 'will',
  '1': 'hp',
  '3': 'defense',
  '2': 'attack',
}
const WEAPON_MODIFIER_IDS: Array<[string, string]> = [
  ['wpn_sp_attr_crirate_', '9'],
  ['wpn_sp_attr_usgs_', '44'],
  ['wpn_sp_attr_phy_spell_', '87'],
  ['wpn_sp_attr_magicdam_', 'SpellDamageIncrease'],
  ['wpn_sp_attr_electrondam_', 'PulseDamageIncrease'],
  ['wpn_sp_attr_naturaldam_', 'NaturalDamageIncrease'],
  ['wpn_sp_attr_heal_', '29'],
  ['wpn_sp_attr_phydam_', '50'],
  ['wpn_sp_attr_firedam_', 'FireDamageIncrease'],
  ['wpn_sp_attr_crystdam_', 'CrystDamageIncrease'],
]
type PlannerCharacter = PlannerGameData['characters'][string]
type PlannerWeapon = PlannerGameData['weapons'][string]
const characters = plannerGameData.characters as Record<string, PlannerCharacter>
const weapons = plannerGameData.weapons as Record<string, PlannerWeapon>
const equipment = plannerGameData.equipment as Record<string, PlannerEquipmentStatData[]>
const equipmentSuits = plannerGameData.equipmentSuits

function clamp(value: number, minimum: number, maximum: number): number {
  const numericValue = Number.isFinite(value) ? value : minimum
  return Math.min(maximum, Math.max(minimum, Math.round(numericValue)))
}

function addMaterial(target: Map<string, number>, itemId: string, count: number): void {
  if (count <= 0) return
  target.set(itemId, (target.get(itemId) ?? 0) + count)
}

function addMaterials(target: Map<string, number>, values: PlannerMaterialTuple[]): void {
  for (const [itemId, count] of values) addMaterial(target, itemId, count)
}

function addCharacterLevelCosts(data: PlannerCharacterData, currentLevel: number, targetLevel: number, result: GrowthCalculationResult): void {
  for (let level = currentLevel; level < targetLevel; level += 1) {
    const row = data.levels.find((entry) => entry.level === level)
    if (!row) continue
    if (level < 60) result.stageOneExp += row.levelUpExp
    else result.stageTwoExp += row.levelUpExp
    result.gold += row.levelUpGold
  }
}

export function createDefaultGrowthConfig(kind: 'character' | 'weapon', id: string): GrowthConfig {
  if (kind === 'weapon') {
    const data = weapons[id]
    return {
      kind,
      id,
      currentLevel: 1,
      targetLevel: data?.levels.at(-1)?.level ?? 90,
      currentBreakStage: 0,
      targetBreakStage: data?.breakthroughs.at(-1)?.stage ?? 4,
    }
  }
  const data = characters[id]
  return {
    kind,
    id,
    currentLevel: 1,
    targetLevel: data?.levels.at(-1)?.level ?? 90,
    currentBreakStage: 0,
    targetBreakStage: data?.promotions.at(-1)?.breakStage ?? 4,
    currentSkillLevels: data?.skills.map(() => 1) ?? [],
    targetSkillLevels: data?.skills.map((skill) => skill.maxLevel) ?? [],
    currentTalentIds: [],
    targetTalentIds: data?.talents.map((node) => node.id) ?? [],
    currentAttributeNodeIds: [],
    targetAttributeNodeIds: data?.attributeNodes.map((node) => node.id) ?? [],
    currentEquipmentNodeIds: [],
    targetEquipmentNodeIds: data?.equipmentNodes.map((node) => node.id) ?? [],
    currentLogisticsNodeIds: [],
    targetLogisticsNodeIds: data?.logisticsNodes.map((node) => node.id) ?? [],
  }
}

export function normalizeGrowthConfig(config: GrowthConfig): GrowthConfig {
  if (config.kind === 'weapon') {
    const data = weapons[config.id]
    const maxLevel = data?.levels.at(-1)?.level ?? 90
    const maxBreakStage = data?.breakthroughs.at(-1)?.stage ?? 4
    const currentLevel = clamp(config.currentLevel, 1, maxLevel)
    const currentBreakStage = clamp(config.currentBreakStage, 0, maxBreakStage)
    return {
      ...config,
      currentLevel,
      targetLevel: clamp(config.targetLevel, currentLevel, maxLevel),
      currentBreakStage,
      targetBreakStage: clamp(config.targetBreakStage, currentBreakStage, maxBreakStage),
    }
  }
  const data = characters[config.id]
  const maxLevel = data?.levels.at(-1)?.level ?? 90
  const maxBreakStage = data?.promotions.at(-1)?.breakStage ?? 4
  const currentLevel = clamp(config.currentLevel, 1, maxLevel)
  const currentBreakStage = clamp(config.currentBreakStage, 0, maxBreakStage)
  const sourceCurrentSkillLevels = Array.isArray(config.currentSkillLevels) ? config.currentSkillLevels : []
  const sourceTargetSkillLevels = Array.isArray(config.targetSkillLevels) ? config.targetSkillLevels : []
  const currentSkillLevels = data?.skills.map((skill, index) => clamp(sourceCurrentSkillLevels[index] ?? 1, 1, skill.maxLevel)) ?? []
  const valid = (ids: string[] | undefined, nodes: Array<{ id: string }>) => [...new Set(Array.isArray(ids) ? ids : [])].filter((id) => nodes.some((node) => node.id === id))
  const currentTalentIds = valid(config.currentTalentIds, data?.talents ?? [])
  const targetTalentIds = valid(config.targetTalentIds ?? data?.talents.map((node) => node.id), data?.talents ?? [])
  const currentAttributeNodeIds = valid(config.currentAttributeNodeIds, data?.attributeNodes ?? [])
  const targetAttributeNodeIds = valid(config.targetAttributeNodeIds ?? data?.attributeNodes.map((node) => node.id), data?.attributeNodes ?? [])
  const currentEquipmentNodeIds = valid(config.currentEquipmentNodeIds, data?.equipmentNodes ?? [])
  const targetEquipmentNodeIds = valid(config.targetEquipmentNodeIds ?? data?.equipmentNodes.map((node) => node.id), data?.equipmentNodes ?? [])
  const currentLogisticsNodeIds = valid(config.currentLogisticsNodeIds, data?.logisticsNodes ?? [])
  const targetLogisticsNodeIds = valid(config.targetLogisticsNodeIds ?? data?.logisticsNodes.map((node) => node.id), data?.logisticsNodes ?? [])
  return {
    ...config,
    currentLevel,
    targetLevel: clamp(config.targetLevel, currentLevel, maxLevel),
    currentBreakStage,
    targetBreakStage: clamp(config.targetBreakStage, currentBreakStage, maxBreakStage),
    currentSkillLevels,
    targetSkillLevels: data?.skills.map((skill, index) => clamp(sourceTargetSkillLevels[index] ?? skill.maxLevel, currentSkillLevels[index] ?? 1, skill.maxLevel)) ?? [],
    currentTalentIds,
    targetTalentIds: [...new Set([...currentTalentIds, ...targetTalentIds])],
    currentAttributeNodeIds,
    targetAttributeNodeIds: [...new Set([...currentAttributeNodeIds, ...targetAttributeNodeIds])],
    currentEquipmentNodeIds,
    targetEquipmentNodeIds: [...new Set([...currentEquipmentNodeIds, ...targetEquipmentNodeIds])],
    currentLogisticsNodeIds,
    targetLogisticsNodeIds: [...new Set([...currentLogisticsNodeIds, ...targetLogisticsNodeIds])],
  }
}

export function calculateGrowthRequirements(configs: GrowthConfig[]): GrowthCalculationResult {
  const result: GrowthCalculationResult = { materials: [], stageOneExp: 0, stageTwoExp: 0, weaponExp: 0, gold: 0 }
  const materialMap = new Map<string, number>()
  for (const rawConfig of configs) {
    const config = normalizeGrowthConfig(rawConfig)
    if (config.kind === 'weapon') {
      const data = weapons[config.id]
      if (!data) continue
      for (let level = config.currentLevel; level < config.targetLevel; level += 1) {
        const row = data.levels.find((entry) => entry.level === level)
        if (!row) continue
        result.weaponExp += row.levelUpExp
        result.gold += row.levelUpGold
      }
      for (const breakthrough of data.breakthroughs) {
        if (breakthrough.stage > config.currentBreakStage && breakthrough.stage <= config.targetBreakStage) addMaterials(materialMap, breakthrough.materials)
      }
      continue
    }
    const data = characters[config.id]
    if (!data) continue
    addCharacterLevelCosts(data, config.currentLevel, config.targetLevel, result)
    for (const promotion of data.promotions) {
      if (promotion.breakStage > config.currentBreakStage && promotion.breakStage <= config.targetBreakStage) addMaterials(materialMap, promotion.materials)
    }
    data.skills.forEach((skill, index) => {
      const current = config.currentSkillLevels[index] ?? 1
      const target = config.targetSkillLevels[index] ?? current
      for (const level of skill.materialsByLevel) {
        if (level.level > current && level.level <= target) addMaterials(materialMap, level.materials)
      }
    })
    const addSelectedNodes = <T extends { id: string; materials: PlannerMaterialTuple[] }>(nodes: T[], currentIds: string[], targetIds: string[]) => {
      const current = new Set(currentIds)
      const target = new Set(targetIds)
      for (const node of nodes) {
        if (target.has(node.id) && !current.has(node.id)) addMaterials(materialMap, node.materials)
      }
    }
    addSelectedNodes(data.talents, config.currentTalentIds, config.targetTalentIds)
    addSelectedNodes(data.attributeNodes, config.currentAttributeNodeIds, config.targetAttributeNodeIds)
    addSelectedNodes(data.equipmentNodes, config.currentEquipmentNodeIds, config.targetEquipmentNodeIds)
    addSelectedNodes(data.logisticsNodes, config.currentLogisticsNodeIds, config.targetLogisticsNodeIds)
  }
  result.gold += materialMap.get(GOLD_ID) ?? 0
  materialMap.delete(GOLD_ID)
  result.materials = [...materialMap.entries()].map(([itemId, count]) => ({ itemId, count })).sort((left, right) => right.count - left.count || left.itemId.localeCompare(right.itemId))
  return result
}

export function estimateFarming(result: GrowthCalculationResult): FarmingEstimate {
  const requirements: MaterialRequirement[] = [
    { itemId: STAGE_ONE_EXP_ID, count: result.stageOneExp },
    { itemId: STAGE_TWO_EXP_ID, count: result.stageTwoExp },
    { itemId: WEAPON_EXP_ID, count: result.weaponExp },
    { itemId: GOLD_ID, count: result.gold },
    ...result.materials,
  ].filter((entry) => entry.count > 0)
  const stageRequirements = new Map<string, MaterialRequirement[]>()
  for (const requirement of requirements) {
    const candidates = plannerGameData.dungeons.filter((dungeon) => dungeon.yields.some(([itemId]) => itemId === requirement.itemId))
    const dungeon = candidates.sort((left, right) => {
      const leftYield = left.yields.find(([itemId]) => itemId === requirement.itemId)?.[1] ?? 0
      const rightYield = right.yields.find(([itemId]) => itemId === requirement.itemId)?.[1] ?? 0
      return left.stamina / leftYield - right.stamina / rightYield
    })[0]
    if (!dungeon) continue
    stageRequirements.set(dungeon.rewardId, [...(stageRequirements.get(dungeon.rewardId) ?? []), requirement])
  }
  const stages = [...stageRequirements.entries()].map(([rewardId, assigned]) => {
    const dungeon = plannerGameData.dungeons.find((entry) => entry.rewardId === rewardId)
    if (!dungeon) throw new Error(`Missing planner dungeon ${rewardId}`)
    const runs = Math.max(...assigned.map((requirement) => {
      const output = dungeon.yields.find(([itemId]) => itemId === requirement.itemId)?.[1] ?? 1
      return Math.ceil(requirement.count / output)
    }))
    return { dungeon, runs, stamina: runs * dungeon.stamina, requirements: assigned }
  }).sort((left, right) => right.stamina - left.stamina || left.dungeon.id.localeCompare(right.dungeon.id))
  return {
    stages,
    totalRuns: stages.reduce((sum, stage) => sum + stage.runs, 0),
    totalStamina: stages.reduce((sum, stage) => sum + stage.stamina, 0),
  }
}

function parseFirstNumber(value: string): number {
  const match = value.replace(/<[^>]+>/g, '').match(/[+-]?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function addModifier(target: Map<string, PanelStatModifier>, id: string, value: number, isPercent: boolean): void {
  const key = `${id}:${isPercent ? 'percent' : 'flat'}`
  const current = target.get(key)
  target.set(key, { id, isPercent, value: (current?.value ?? 0) + value })
}

function applyCoreValue(
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  attributeId: string,
  value: number,
  isPercent: boolean
): boolean {
  const key = CORE_KEY_BY_ID[attributeId]
  if (!key) return false
  if (isPercent) percentages[key] = (percentages[key] ?? 0) + value / 100
  else stats[key] += value
  return true
}

function addEquipmentStats(
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  modifiers: Map<string, PanelStatModifier>,
  character: PlannerCharacter,
  equipmentId: string | null,
  statLevels: number[]
): void {
  if (!equipmentId) return
  const data = equipment[equipmentId]
  if (!data) return
  data.forEach((stat, statIndex) => {
    const level = clamp(statLevels[statIndex] ?? stat.values.length - 1, 0, Math.max(0, stat.values.length - 1))
    const rawValue = stat.values[level] ?? 0
    const display = stat.displayValues?.[level] ?? ''
    const isPercent = display.includes('%')
    const value = isPercent ? Math.abs(parseFirstNumber(display)) : rawValue
    const resolvedId = stat.attributeId === 'Main' ? character.mainAttributeId : stat.attributeId === 'Sub' ? character.subAttributeId : stat.attributeId
    const appliedToCore = applyCoreValue(stats, percentages, resolvedId, value, isPercent)
    if (stat.attributeId === 'Main' || stat.attributeId === 'Sub') addModifier(modifiers, stat.attributeId, value, isPercent)
    else if (!appliedToCore) addModifier(modifiers, stat.attributeId, value, isPercent)
  })
}

function applyEquipmentSetValues(
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  values: Record<string, number>
): void {
  stats.strength += values.str_up ?? 0
  stats.agility += values.agi_up ?? 0
  stats.intellect += values.wisd_up ?? 0
  stats.will += values.will_up ?? 0
  stats.hp += values.hp_up ?? 0
  stats.hp += values.hp_add ?? 0
  stats.defense += values.def_up ?? 0
  if (values.atk_up) {
    if (Math.abs(values.atk_up) <= 1) percentages.attack = (percentages.attack ?? 0) + values.atk_up
    else stats.attack += values.atk_up
  }
}

function applyWeaponSkill(
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  modifiers: Map<string, PanelStatModifier>,
  character: PlannerCharacter,
  skillId: string,
  description: string
): void {
  const value = Math.abs(parseFirstNumber(description))
  if (skillId.startsWith('wpn_attr_str_')) stats.strength += value
  else if (skillId.startsWith('wpn_attr_agi_')) stats.agility += value
  else if (skillId.startsWith('wpn_attr_wisd_')) stats.intellect += value
  else if (skillId.startsWith('wpn_attr_will_')) stats.will += value
  else if (skillId.startsWith('wpn_attr_main_')) {
    applyCoreValue(stats, percentages, character.mainAttributeId, value, false)
    addModifier(modifiers, 'Main', value, false)
  }
  else if (skillId.startsWith('wpn_sp_attr_atk_')) applyCoreValue(stats, percentages, CORE_ATTRIBUTE_IDS.attack, value, true)
  else if (skillId.startsWith('wpn_sp_attr_hp_')) applyCoreValue(stats, percentages, CORE_ATTRIBUTE_IDS.hp, value, true)
  else if (skillId.startsWith('sk_wpn_') && !description.includes('%')) stats.attack += value
  else {
    const modifierId = WEAPON_MODIFIER_IDS.find(([prefix]) => skillId.startsWith(prefix))?.[1]
    if (modifierId) addModifier(modifiers, modifierId, value, description.includes('%'))
  }
}
function attributeSource(attributeId: string): PanelAttributeContribution['source'] {
  if (attributeId === CORE_ATTRIBUTE_IDS.agility) return 'agility'
  if (attributeId === CORE_ATTRIBUTE_IDS.intellect) return 'intellect'
  if (attributeId === CORE_ATTRIBUTE_IDS.will) return 'will'
  return 'strength'
}

function addDerivedAttributes(stats: PanelStats, contributions: PanelAttributeContribution[], character: PlannerCharacter): void {
  const derived = plannerGameData.derivedAttributes
  const hpIncrease = stats.strength * derived.efficiencyOfSTR
  stats.hp += hpIncrease
  if (hpIncrease > 0) contributions.push({ source: 'strength', target: 'hp', value: hpIncrease, isPercent: false })

  const mainValue = character.mainAttributeId === CORE_ATTRIBUTE_IDS.strength ? stats.strength : character.mainAttributeId === CORE_ATTRIBUTE_IDS.agility ? stats.agility : character.mainAttributeId === CORE_ATTRIBUTE_IDS.intellect ? stats.intellect : stats.will
  const subValue = character.subAttributeId === CORE_ATTRIBUTE_IDS.strength ? stats.strength : character.subAttributeId === CORE_ATTRIBUTE_IDS.agility ? stats.agility : character.subAttributeId === CORE_ATTRIBUTE_IDS.intellect ? stats.intellect : stats.will
  const mainAttackIncrease = mainValue * derived.atkRateOfMain
  const subAttackIncrease = subValue * derived.atkRateOfSub
  stats.attack *= 1 + mainAttackIncrease + subAttackIncrease
  if (mainAttackIncrease > 0) contributions.push({ source: attributeSource(character.mainAttributeId), target: 'attack', value: mainAttackIncrease * 100, isPercent: true })
  if (subAttackIncrease > 0) contributions.push({ source: attributeSource(character.subAttributeId), target: 'attack', value: subAttackIncrease * 100, isPercent: true })

  const physicalResistance = stats.agility * derived.efficiencyOfAGI * 100
  const fireResistance = stats.intellect * derived.efficiencyOfWISD * 100
  const healingIncrease = stats.will * derived.recoverEfficiencyOfWILL * 100
  if (physicalResistance > 0) contributions.push({ source: 'agility', target: 'physicalDamageReduction', value: physicalResistance, isPercent: true })
  if (fireResistance > 0) contributions.push({ source: 'intellect', target: 'fireDamageReduction', value: fireResistance, isPercent: true })
  if (healingIncrease > 0) contributions.push({ source: 'will', target: 'healingReceived', value: healingIncrease, isPercent: true })
  const damageReduction = 1 - 1 / (1 + derived.efficiencyOfDEF * stats.defense)
  if (damageReduction > 0) contributions.push({ source: 'defense', target: 'defenseDamageReduction', value: damageReduction * 100, isPercent: true })
}
function createEmptyPanelStats(): PanelStats {
  return { strength: 0, agility: 0, intellect: 0, will: 0, hp: 0, defense: 0, attack: 0, modifiers: [], attributeContributions: [], setEffects: [] }
}

export function calculatePanelStats(config: PanelPreviewConfig): PanelStats {
  const character = characters[config.characterId]
  if (!character) return createEmptyPanelStats()
  const baseLevel = character.levels.find((entry) => entry.level === config.level) ?? character.levels.at(-1)
  const stats = createEmptyPanelStats()
  const percentages: Partial<Record<CorePanelStatKey, number>> = {}
  const modifiers = new Map<string, PanelStatModifier>()
  for (const stat of baseLevel?.stats ?? []) {
    const key = CORE_KEY_BY_ID[stat.attributeId]
    if (key) stats[key] = stat.value
  }
  const attributeCount = clamp(config.attributeNodeCount, 0, character.attributeNodes.length)
  for (const node of character.attributeNodes.slice(0, attributeCount)) {
    for (const stat of node.stats) applyCoreValue(stats, percentages, stat.attributeId, stat.value, false)
  }
  const potentialLevel = clamp(config.potentialLevel, 0, character.potentials.at(-1)?.level ?? 0)
  for (const potential of character.potentials) {
    if (potential.level > potentialLevel) continue
    for (const stat of potential.stats) {
      const value = stat.isPercent ? Math.abs(stat.value * 100) : stat.value
      if (!applyCoreValue(stats, percentages, stat.attributeId, value, stat.isPercent)) {
        addModifier(modifiers, stat.attributeId, value, stat.isPercent)
      }
    }
  }
  const selectedEquipment = [config.armor, config.gloves, config.accessoryOne, config.accessoryTwo]
  for (const item of selectedEquipment) addEquipmentStats(stats, percentages, modifiers, character, item.equipmentId, item.statLevels ?? [])
  const suitCounts = new Map<string, { count: number; equipmentId: string }>()
  for (const item of selectedEquipment) {
    if (!item.equipmentId) continue
    const suitId = equipmentSuits[item.equipmentId]?.suitId
    if (!suitId) continue
    const current = suitCounts.get(suitId)
    suitCounts.set(suitId, { count: (current?.count ?? 0) + 1, equipmentId: current?.equipmentId ?? item.equipmentId })
  }
  for (const { count, equipmentId } of suitCounts.values()) {
    for (const effect of equipmentSuits[equipmentId]?.effects ?? []) {
      if (count < effect.requiredPieces) continue
      applyEquipmentSetValues(stats, percentages, effect.staticValues)
      stats.setEffects.push({ id: effect.id, requiredPieces: effect.requiredPieces, pieceCount: count, equipmentId })
    }
  }
  if (config.weaponId) {
    const weapon = weapons[config.weaponId]
    const weaponLevel = weapon?.levels.find((entry) => entry.level === config.weaponLevel) ?? weapon?.levels.at(-1)
    stats.attack += weaponLevel?.baseAttack ?? 0
    weapon?.skills.slice(0, 2).forEach((skill, index) => {
      const selectedLevel = clamp(config.weaponSkillLevels[index] ?? 1, 1, skill.levels.at(-1)?.level ?? 1)
      const description = skill.levels.find((entry) => entry.level === selectedLevel)?.description['zh-CN'] ?? ''
      applyWeaponSkill(stats, percentages, modifiers, character, skill.id, description)
    })
  }
  for (const key of ['strength', 'agility', 'intellect', 'will', 'hp', 'defense', 'attack'] as const) {
    stats[key] *= 1 + (percentages[key] ?? 0)
  }
  addDerivedAttributes(stats, stats.attributeContributions, character)
  for (const key of ['strength', 'agility', 'intellect', 'will', 'hp', 'defense', 'attack'] as const) stats[key] = Math.round(stats[key] * 100) / 100
  stats.modifiers = [...modifiers.values()].map((modifier) => ({ ...modifier, value: Math.round(modifier.value * 100) / 100 }))
  stats.attributeContributions = stats.attributeContributions.map((contribution) => ({ ...contribution, value: Math.round(contribution.value * 100) / 100 }))
  return stats
}

export { PLANNER_RESOURCE_IDS }
