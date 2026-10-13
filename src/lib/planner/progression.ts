import { getCachedPlannerGameData } from '@/lib/planner/planner-data-loader'
import { PLANNER_RESOURCE_IDS } from '@/lib/planner-resource-ids'
import type {
  FarmingEstimate,
  GrowthCalculationResult,
  GrowthConfig,
  MaterialRequirement,
  PanelAttributeContribution,
  PanelPreviewConfig,
  PlannerAttributeLimitData,
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

/**
 * Planner data is loaded via the shared async chunk (planner-data-loader);
 * read it lazily inside each call instead of at module scope so this module
 * never drags the multi-MB dataset into a route chunk.
 */
function characterData(id: string): PlannerCharacter | undefined {
  return getCachedPlannerGameData()?.characters[id]
}

function weaponData(id: string): PlannerWeapon | undefined {
  return getCachedPlannerGameData()?.weapons[id]
}

function clamp(value: number, minimum: number, maximum: number): number {
  const numericValue = Number.isFinite(value) ? value : minimum
  return Math.min(maximum, Math.max(minimum, Math.round(numericValue)))
}

/**
 * 去掉二进制浮点运算残留的尾数, 但**不做展示用取整**。
 *
 * 面板预览要与游戏内数值逐位对照, 所以真实有效位必须全部保留 (源数据本身
 * 就有 5 位小数, 相乘后位数更多)。问题只在于 IEEE754 的表示误差会产出
 * `105.63402049999999` 这类尾巴。`toPrecision(12)` 远高于任何真实有效位数,
 * 足以只削掉误差; 再经 Number() 归一化即可去掉尾随零。
 */
function stripFloatNoise(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toPrecision(12))
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
    const data = weaponData(id)
    return {
      kind,
      id,
      currentLevel: 1,
      targetLevel: data?.levels.at(-1)?.level ?? 90,
      currentBreakStage: 0,
      targetBreakStage: data?.breakthroughs.at(-1)?.stage ?? 4,
    }
  }
  const data = characterData(id)
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

/**
 * Pre-fix skill arrays used game typeId order 0,1,2,3 (ultimate before combo).
 * Display/data order is now 0,1,3,2. Swap indices 2↔3 once when hydrating old saves.
 */
export function migrateLegacySkillLevelOrder(levels: unknown): number[] | undefined {
  if (!Array.isArray(levels)) return undefined
  const next = levels.map((level) => (typeof level === 'number' && Number.isFinite(level) ? level : 1))
  if (next.length >= 4) {
    const temporary = next[2]
    next[2] = next[3]
    next[3] = temporary
  }
  return next
}

export function normalizeGrowthConfig(config: GrowthConfig): GrowthConfig {
  if (config.kind === 'weapon') {
    const data = weaponData(config.id)
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
  const data = characterData(config.id)
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
      const data = weaponData(config.id)
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
    const data = characterData(config.id)
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
  const dungeons = getCachedPlannerGameData()?.dungeons ?? []
  const stageRequirements = new Map<string, MaterialRequirement[]>()
  for (const requirement of requirements) {
    const candidates = dungeons.filter((dungeon) => dungeon.yields.some(([itemId]) => itemId === requirement.itemId))
    const dungeon = candidates.sort((left, right) => {
      const leftYield = left.yields.find(([itemId]) => itemId === requirement.itemId)?.[1] ?? 0
      const rightYield = right.yields.find(([itemId]) => itemId === requirement.itemId)?.[1] ?? 0
      return left.stamina / leftYield - right.stamina / rightYield
    })[0]
    if (!dungeon) continue
    stageRequirements.set(dungeon.rewardId, [...(stageRequirements.get(dungeon.rewardId) ?? []), requirement])
  }
  const stages = [...stageRequirements.entries()].map(([rewardId, assigned]) => {
    const dungeon = dungeons.find((entry) => entry.rewardId === rewardId)
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

/**
 * 词条乘区 (`ModifierType`): 7 = BaseFinalAddition, 在基值乘算**之后**相加。
 *
 * 游戏侧: `_CalculateBaseAttribute(raw, baseAdd, baseMul, baseFinalAdd, baseFinalMul)`
 * = `(raw + baseAdd) × (1 + baseMul) + baseFinalAdd`; 装备里用这个池的只有
 * 测试型重甲/手甲与 tundra01 t0 件的生命值 (46.33/77.21/125.38) 和 4 件攻击力
 * (11.72/16.19)。
 * 旧数据没有 `modifierType` 字段 (重新生成前), 按 5 (普通固定值) 处理 —— 与修复前一致。
 */
function equipmentStatPool(modifierType: number | undefined): 'base' | 'baseFinal' {
  return modifierType === 7 ? 'baseFinal' : 'base'
}

/** 基值最终加算池: 池内原始单位相加, 与乘算百分比无关。 */
function applyCoreFinalAddition(
  baseFinalAdditions: Partial<Record<CorePanelStatKey, number>>,
  attributeId: string,
  value: number
): boolean {
  const key = CORE_KEY_BY_ID[attributeId]
  if (!key) return false
  baseFinalAdditions[key] = (baseFinalAdditions[key] ?? 0) + value
  return true
}

function addEquipmentStats(
  gameData: PlannerGameData,
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  modifiers: Map<string, PanelStatModifier>,
  baseFinalAdditions: Partial<Record<CorePanelStatKey, number>>,
  character: PlannerCharacter,
  equipmentId: string | null,
  statLevels: number[]
): void {
  if (!equipmentId) return
  const data: PlannerEquipmentStatData[] | undefined = gameData.equipment[equipmentId]
  if (!data) return
  data.forEach((stat, statIndex) => {
    const level = clamp(statLevels[statIndex] ?? stat.values.length - 1, 0, Math.max(0, stat.values.length - 1))
    const rawValue = stat.values[level] ?? 0
    const display = stat.displayValues?.[level] ?? ''
    const isPercent = display.includes('%')
    const pool = equipmentStatPool(stat.modifierType)
    // 乘算池用显示值 (百分点), 其余池用原始值 (游戏池内是原始单位)。
    const value = isPercent && pool === 'base' ? Math.abs(parseFirstNumber(display)) : rawValue
    const resolvedId = stat.attributeId === 'Main' ? character.mainAttributeId : stat.attributeId === 'Sub' ? character.subAttributeId : stat.attributeId
    const appliedToCore = pool === 'baseFinal'
      ? applyCoreFinalAddition(baseFinalAdditions, resolvedId, value)
      : applyCoreValue(stats, percentages, resolvedId, value, isPercent)
    if (stat.attributeId === 'Main' || stat.attributeId === 'Sub') addModifier(modifiers, stat.attributeId, value, isPercent)
    else if (!appliedToCore) addModifier(modifiers, stat.attributeId, value, isPercent)
  })
}

function applyEquipmentSetValues(
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  values: Record<string, number>
): void {
  // 只保留 STATIC_SET_VALUE_LABELS 白名单里的字段, 且名字必须出现在效果描述首句
  // (scripts/lib/generate-planner-data.ts 的 STATIC_SET_VALUE_LABELS)。
  // 不要把 `hp_add` 加进来: 原始表里它是「击败敌人后回复100点生命值」的回复量。
  stats.strength += values.str_up ?? 0
  stats.agility += values.agi_up ?? 0
  stats.intellect += values.wisd_up ?? 0
  stats.will += values.will_up ?? 0
  stats.hp += values.hp_up ?? 0
  stats.defense += values.def_up ?? 0
  if (values.atk_up) {
    // 套组效果的攻击力加成一律是百分比 (0.08~0.15); 大于 1 只可能来自原始表里
    // 与首句无关的其他黑名字段, 按固定值累加, 而不是当成 +2000% 使用。
    if (Math.abs(values.atk_up) <= 1) percentages.attack = (percentages.attack ?? 0) + values.atk_up
    else stats.attack += values.atk_up
  }
}

const SK_WPN_PERMANENT_PATTERNS: Array<{ pattern: RegExp; handler: 'core' | 'mainAttr' | 'subAttr' | 'modifier'; attributeId?: string }> = [
  { pattern: /^攻击力/, handler: 'core', attributeId: CORE_ATTRIBUTE_IDS.attack },
  { pattern: /^主能力/, handler: 'mainAttr' },
  { pattern: /^副能力/, handler: 'subAttr' },
  { pattern: /^最大生命值/, handler: 'core', attributeId: CORE_ATTRIBUTE_IDS.hp },
  { pattern: /^防御力/, handler: 'core', attributeId: CORE_ATTRIBUTE_IDS.defense },
  { pattern: /^物理伤害/, handler: 'modifier', attributeId: '50' },
  { pattern: /^法术伤害/, handler: 'modifier', attributeId: 'SpellDamageIncrease' },
  { pattern: /^灼热伤害/, handler: 'modifier', attributeId: 'FireDamageIncrease' },
  { pattern: /^电磁伤害/, handler: 'modifier', attributeId: 'PulseDamageIncrease' },
  { pattern: /^寒冷伤害/, handler: 'modifier', attributeId: 'CrystDamageIncrease' },
  { pattern: /^自然伤害/, handler: 'modifier', attributeId: 'NaturalDamageIncrease' },
  { pattern: /^源石技艺强度/, handler: 'modifier', attributeId: '87' },
  { pattern: /^暴击率/, handler: 'modifier', attributeId: '9' },
  { pattern: /^治疗效率/, handler: 'modifier', attributeId: '29' },
  { pattern: /^所有技能伤害/, handler: 'modifier', attributeId: 'AllSkillDamageIncrease' },
  { pattern: /^战技伤害/, handler: 'modifier', attributeId: 'NormalSkillDamageIncrease' },
  { pattern: /^终结技伤害/, handler: 'modifier', attributeId: 'UltimateSkillDamageIncrease' },
  { pattern: /^连携技伤害/, handler: 'modifier', attributeId: 'ComboSkillDamageIncrease' },
]

/** Extract the first sentence (before \n or first 。) from a weapon skill description. */
function firstSentence(description: string): string {
  const newlineIdx = description.indexOf('\n')
  const periodIdx = description.indexOf('。')
  const end = Math.min(
    newlineIdx >= 0 ? newlineIdx : Infinity,
    periodIdx >= 0 ? periodIdx + 1 : Infinity,
  )
  return end < Infinity ? description.slice(0, end) : description
}

/**
 * Parse and apply a sk_wpn_* (third weapon skill) permanent bonus.
 * Only the first sentence is considered; if it matches a known stat
 * pattern it is treated as unconditional, otherwise the skill is skipped.
 */
function applySkWpnSkill(
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  modifiers: Map<string, PanelStatModifier>,
  character: PlannerCharacter,
  description: string,
): void {
  const sentence = firstSentence(description)
  if (!sentence) return
  const isPercent = sentence.includes('%')
  const value = Math.abs(parseFirstNumber(sentence))
  if (value === 0) return

  for (const { pattern, handler, attributeId } of SK_WPN_PERMANENT_PATTERNS) {
    if (!pattern.test(sentence)) continue
    switch (handler) {
      case 'core':
        if (attributeId) applyCoreValue(stats, percentages, attributeId, value, isPercent)
        return
      case 'mainAttr':
        applyCoreValue(stats, percentages, character.mainAttributeId, value, isPercent)
        addModifier(modifiers, 'Main', value, isPercent)
        return
      case 'subAttr':
        applyCoreValue(stats, percentages, character.subAttributeId, value, isPercent)
        addModifier(modifiers, 'Sub', value, isPercent)
        return
      case 'modifier':
        if (attributeId) addModifier(modifiers, attributeId, value, isPercent)
        return
    }
  }
  // Sentence didn't match any known permanent pattern → likely conditional (e.g.
  // "装备者的战技命中敌人时…").  Skip silently.
}

function applyWeaponSkill(
  stats: PanelStats,
  percentages: Partial<Record<CorePanelStatKey, number>>,
  modifiers: Map<string, PanelStatModifier>,
  character: PlannerCharacter,
  skillId: string,
  description: string,
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
  else if (skillId.startsWith('sk_wpn_')) applySkWpnSkill(stats, percentages, modifiers, character, description)
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

/**
 * 按上游 `AttributeMetaTable` 的区间钳制属性值。
 *
 * 游戏在**每个乘区结算后**都 Clamp 一次 (`AttributesCalculator._CalculateBaseAttribute`
 * 的 min/max 参数): `baseValue = Clamp((Clamp(raw + baseAdd) × max(baseMul,0) + baseFinalAdd) × baseFinalMul)`。
 * `attributeLimits` 缺失时（旧数据）不钳制，与修复前一致。
 */
function clampToLimit(value: number, limit: PlannerAttributeLimitData | undefined): number {
  if (!limit) return value
  let result = value
  if (limit.min !== undefined) result = Math.max(limit.min, result)
  if (limit.max !== undefined) result = Math.min(limit.max, result)
  return result
}

/**
 * 四维属性 (力量/敏捷/智识/意志) 在派生公式里只取整数部分。
 *
 * 游戏侧没有把这条写在任何可读的表或 Lua 里 (`Attributes` 全部返回 `double`,
 * `AttributeUtils.lua` 只在显示层 floor), 结论来自游戏内实测, 两例互相印证:
 * - 余烬 L90 基础力量 176.41174, 其余力量来源全为整数 ⇒ 面板显示 695 时真值为
 *   695.41174。「力量提供的生命值」游戏内为 3475 = 5×695; 若用真值应为 3477.057。
 * - 同一角色的属性详情「来自力量的攻击加成 +171.0%」= 0.005×342; 真值 342.41174
 *   应为 171.206% (游戏百分比显示保留一位, floor)。
 */
function integerPart(value: number): number {
  return Math.floor(value)
}

/**
 * 力量→生命的换算属于「基值加成」池, 必须并入生命池**之后**再乘生命值%。
 *
 * 游戏侧: `Attributes.GetHpBaseAddFromStrAttribute()` 把 `力量 × efficiencyOfSTR`
 * 加进 MaxHp 的 baseAdd; 装备/套装的「最大生命值+X%」是 `ModifierType.BaseMultiplier` (6),
 * `AttributesCalculator._CalculateBaseAttribute` 的次序为 `(raw + baseAdd) × (1 + baseMultiplier)`。
 * 旧实现把换算放在百分比之后相加, 高生命%配装系统性偏低 (余烬 + 大雷斑 + 生物辅助四件套
 * 会少算 6259.9, 约 33%)。
 */
function applyStrengthHpConversion(gameData: PlannerGameData, stats: PanelStats, contributions: PanelAttributeContribution[]): void {
  const hpIncrease = integerPart(stats.strength) * gameData.derivedAttributes.efficiencyOfSTR
  stats.hp += hpIncrease
  if (hpIncrease > 0) contributions.push({ source: 'strength', target: 'hp', value: hpIncrease, isPercent: false })
}

/**
 * 其余派生属性只影响面板上的「属性提供」条目与攻击力末位乘算; 均以四维取整后的值为输入。
 */
function addDerivedAttributes(gameData: PlannerGameData, stats: PanelStats, contributions: PanelAttributeContribution[], character: PlannerCharacter): void {
  const derived = gameData.derivedAttributes
  const mainValue = integerPart(character.mainAttributeId === CORE_ATTRIBUTE_IDS.strength ? stats.strength : character.mainAttributeId === CORE_ATTRIBUTE_IDS.agility ? stats.agility : character.mainAttributeId === CORE_ATTRIBUTE_IDS.intellect ? stats.intellect : stats.will)
  const subValue = integerPart(character.subAttributeId === CORE_ATTRIBUTE_IDS.strength ? stats.strength : character.subAttributeId === CORE_ATTRIBUTE_IDS.agility ? stats.agility : character.subAttributeId === CORE_ATTRIBUTE_IDS.intellect ? stats.intellect : stats.will)
  const mainAttackIncrease = mainValue * derived.atkRateOfMain
  const subAttackIncrease = subValue * derived.atkRateOfSub
  stats.attack *= 1 + mainAttackIncrease + subAttackIncrease
  if (mainAttackIncrease > 0) contributions.push({ source: attributeSource(character.mainAttributeId), target: 'attack', value: mainAttackIncrease * 100, isPercent: true })
  if (subAttackIncrease > 0) contributions.push({ source: attributeSource(character.subAttributeId), target: 'attack', value: subAttackIncrease * 100, isPercent: true })

  // 敏捷/智识提供的是「抗性点数」, 换算成承伤系数是反比例而非线性:
  // 抗性点数 = 100 - 100/(1 + efficiency×属性), 抗性区 = 1/(1 + efficiency×属性)。
  // 同一形式已在防御力上使用; 旧写的 `属性 × efficiency × 100` 是线性近似, 会高估减免
  // (余烬 96.95876 敏捷: 9.6959% vs 正确 8.7591%)。
  const physicalResistance = (1 - 1 / (1 + derived.efficiencyOfAGI * integerPart(stats.agility))) * 100
  if (physicalResistance > 0) contributions.push({ source: 'agility', target: 'physicalDamageReduction', value: physicalResistance, isPercent: true })

  // Intellect (WISD) provides spell resistance, which reduces elemental spell damage.
  const spellResistance = (1 - 1 / (1 + derived.efficiencyOfWISD * integerPart(stats.intellect))) * 100
  if (spellResistance > 0) {
    for (const target of ['fireDamageReduction', 'pulseDamageReduction', 'crystDamageReduction', 'naturalDamageReduction'] as const) {
      contributions.push({ source: 'intellect', target, value: spellResistance, isPercent: true })
    }
  }

  const healingIncrease = integerPart(stats.will) * derived.recoverEfficiencyOfWILL * 100
  if (healingIncrease > 0) contributions.push({ source: 'will', target: 'healingReceived', value: healingIncrease, isPercent: true })

  const damageReduction = 1 - 1 / (1 + derived.efficiencyOfDEF * stats.defense)
  if (damageReduction > 0) contributions.push({ source: 'defense', target: 'defenseDamageReduction', value: damageReduction * 100, isPercent: true })
}
function createEmptyPanelStats(): PanelStats {
  return { strength: 0, agility: 0, intellect: 0, will: 0, hp: 0, defense: 0, attack: 0, modifiers: [], attributeContributions: [], setEffects: [] }
}

export function calculatePanelStats(config: PanelPreviewConfig): PanelStats {
  const gameData = getCachedPlannerGameData()
  const character = gameData?.characters[config.characterId]
  if (!gameData || !character) return createEmptyPanelStats()
  const baseLevel = character.levels.find((entry) => entry.level === config.level) ?? character.levels.at(-1)
  const stats = createEmptyPanelStats()
  const percentages: Partial<Record<CorePanelStatKey, number>> = {}
  const baseFinalAdditions: Partial<Record<CorePanelStatKey, number>> = {}
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
  for (const item of selectedEquipment) addEquipmentStats(gameData, stats, percentages, modifiers, baseFinalAdditions, character, item.equipmentId, item.statLevels ?? [])
  const suitCounts = new Map<string, { count: number; equipmentId: string }>()
  for (const item of selectedEquipment) {
    if (!item.equipmentId) continue
    const suitId = gameData.equipmentSuits[item.equipmentId]?.suitId
    if (!suitId) continue
    const current = suitCounts.get(suitId)
    suitCounts.set(suitId, { count: (current?.count ?? 0) + 1, equipmentId: current?.equipmentId ?? item.equipmentId })
  }
  for (const { count, equipmentId } of suitCounts.values()) {
    for (const effect of gameData.equipmentSuits[equipmentId]?.effects ?? []) {
      if (count < effect.requiredPieces) continue
      applyEquipmentSetValues(stats, percentages, effect.staticValues)
      stats.setEffects.push({ id: effect.id, requiredPieces: effect.requiredPieces, pieceCount: count, equipmentId })
    }
  }
  if (config.weaponId) {
    const weapon = gameData.weapons[config.weaponId]
    const weaponLevel = weapon?.levels.find((entry) => entry.level === config.weaponLevel) ?? weapon?.levels.at(-1)
    stats.attack += weaponLevel?.baseAttack ?? 0
    weapon?.skills.forEach((skill, index) => {
      const selectedLevel = clamp(config.weaponSkillLevels[index] ?? 1, 1, skill.levels.at(-1)?.level ?? 1)
      const description = skill.levels.find((entry) => entry.level === selectedLevel)?.description ?? ''
      applyWeaponSkill(stats, percentages, modifiers, character, skill.id, description)
    })
  }
  // 基值结算次序按游戏 `_CalculateBaseAttribute`: 先 `(raw + baseAddition) × (1 + baseMultiplier)`,
  // 再加 `baseFinalAddition`, 每步按 AttributeMetaTable 钳制 (乘算池取下限 0)。
  // 生命值必须留到最后: 力量换算的生命要先并入生命池 (见 applyStrengthHpConversion)。
  const limits = gameData.attributeLimits
  const applyBasePools = (key: CorePanelStatKey): number => {
    const limit = limits?.[CORE_ATTRIBUTE_IDS[key]]
    const base = clampToLimit(clampToLimit(stats[key], limit) * Math.max(1 + (percentages[key] ?? 0), 0) + (baseFinalAdditions[key] ?? 0), limit)
    stats[key] = base
    return base
  }
  for (const key of ['strength', 'agility', 'intellect', 'will', 'defense', 'attack'] as const) applyBasePools(key)
  applyStrengthHpConversion(gameData, stats, stats.attributeContributions)
  applyBasePools('hp')
  addDerivedAttributes(gameData, stats, stats.attributeContributions, character)
  // 不做展示用的取整: 面板要与游戏内数值逐位对照, 有多少位就保留多少位。
  // 这里只用 stripFloatNoise 消掉二进制浮点运算的尾巴 (例如 0.1+0.2 的
  // ...0000000004), 真实有效位一律保留; 显示层负责在窄屏上排版。
  for (const key of ['strength', 'agility', 'intellect', 'will', 'hp', 'defense', 'attack'] as const) stats[key] = stripFloatNoise(stats[key])
  stats.modifiers = [...modifiers.values()].map((modifier) => ({ ...modifier, value: stripFloatNoise(modifier.value) }))
  stats.attributeContributions = stats.attributeContributions.map((contribution) => ({ ...contribution, value: stripFloatNoise(contribution.value) }))
  return stats
}

export { PLANNER_RESOURCE_IDS }
