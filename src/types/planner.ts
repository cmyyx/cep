import type { LocalizedText, WikiStatValue } from '@/types/wiki'

export type PlannerEntityKind = 'character' | 'weapon'
export type PlannerMaterialTuple = readonly [itemId: string, count: number]

export interface PlannerCharacterSkillData {
  id: string
  typeId: string
  maxLevel: number
  name: LocalizedText
  iconId: string
  materialsByLevel: Array<{
    level: number
    materials: PlannerMaterialTuple[]
  }>
}

export interface PlannerCharacterNodeData {
  id: string
  breakStage: number
  materials: PlannerMaterialTuple[]
  name: LocalizedText
}

export interface PlannerCharacterAttributeNodeData extends PlannerCharacterNodeData {
  favorability: number
  stats: WikiStatValue[]
}

export interface PlannerCharacterEquipmentNodeData extends PlannerCharacterNodeData {
  equipmentTierLimit: number
}

export interface PlannerCharacterLogisticsNodeData extends PlannerCharacterNodeData {
  index: number
  level: number
}

export interface PlannerCharacterData {
  mainAttributeId: string
  subAttributeId: string
  levels: Array<{
    level: number
    breakStage: number
    isBreakthrough: boolean
    stats: WikiStatValue[]
    levelUpExp: number
    levelUpGold: number
  }>
  skills: PlannerCharacterSkillData[]
  talents: PlannerCharacterNodeData[]
  attributeNodes: PlannerCharacterAttributeNodeData[]
  equipmentNodes: PlannerCharacterEquipmentNodeData[]
  logisticsNodes: PlannerCharacterLogisticsNodeData[]
  promotions: Array<{
    breakStage: number
    requiredLevel: number
    materials: PlannerMaterialTuple[]
  }>
}

export interface PlannerWeaponData {
  levels: Array<{
    level: number
    baseAttack: number
    levelUpExp: number
    levelUpGold: number
  }>
  breakthroughs: Array<{
    stage: number
    requiredLevel: number
    materials: PlannerMaterialTuple[]
  }>
  skills: Array<{
    id: string
    levels: Array<{ level: number; description: LocalizedText }>
  }>
}

export interface PlannerEquipmentStatData {
  attributeId: string
  values: number[]
  displayValues?: string[]
}

export interface PlannerEquipmentSuitEffectData {
  id: string
  requiredPieces: number
  values: Record<string, number>
  staticValues: Record<string, number>
}

export interface PlannerEquipmentSuitData {
  suitId?: string
  effects: PlannerEquipmentSuitEffectData[]
}

export interface PlannerMaterialData {
  name: LocalizedText
  iconId: string
  rarity: number
  expValue?: number
}

export interface PlannerDungeonData {
  id: string
  name: LocalizedText
  seriesId: string
  seriesName: LocalizedText
  rewardId: string
  stamina: number
  yields: PlannerMaterialTuple[]
  rewardItems: PlannerMaterialTuple[]
}

export interface PlannerDerivedAttributeData {
  atkRateOfMain: number
  atkRateOfSub: number
  efficiencyOfAGI: number
  efficiencyOfDEF: number
  efficiencyOfSTR: number
  efficiencyOfWISD: number
  recoverEfficiencyOfWILL: number
}

export interface PlannerGameData {
  characters: Record<string, PlannerCharacterData>
  weapons: Record<string, PlannerWeaponData>
  equipment: Record<string, PlannerEquipmentStatData[]>
  materials: Record<string, PlannerMaterialData>
  equipmentSuits: Record<string, PlannerEquipmentSuitData>
  dungeons: PlannerDungeonData[]
  derivedAttributes: PlannerDerivedAttributeData
}

export interface CharacterGrowthConfig {
  kind: 'character'
  id: string
  currentLevel: number
  targetLevel: number
  currentBreakStage: number
  targetBreakStage: number
  currentSkillLevels: number[]
  targetSkillLevels: number[]
  currentTalentIds: string[]
  targetTalentIds: string[]
  currentAttributeNodeIds: string[]
  targetAttributeNodeIds: string[]
  currentEquipmentNodeIds: string[]
  targetEquipmentNodeIds: string[]
  currentLogisticsNodeIds: string[]
  targetLogisticsNodeIds: string[]
}

export interface WeaponGrowthConfig {
  kind: 'weapon'
  id: string
  currentLevel: number
  targetLevel: number
  currentBreakStage: number
  targetBreakStage: number
}

export type GrowthConfig = CharacterGrowthConfig | WeaponGrowthConfig

export interface MaterialRequirement {
  itemId: string
  count: number
}

export interface GrowthCalculationResult {
  materials: MaterialRequirement[]
  stageOneExp: number
  stageTwoExp: number
  weaponExp: number
  gold: number
}

export interface FarmingStageEstimate {
  dungeon: PlannerDungeonData
  runs: number
  stamina: number
  requirements: MaterialRequirement[]
}

export interface FarmingEstimate {
  stages: FarmingStageEstimate[]
  totalRuns: number
  totalStamina: number
}

export interface PanelEquipmentSelection {
  equipmentId: string | null
  statLevels: number[]
}

export interface PanelPreviewConfig {
  characterId: string
  level: number
  skillLevels: number[]
  talentCount: number
  attributeNodeCount: number
  weaponId: string | null
  weaponLevel: number
  weaponSkillLevels: number[]
  armor: PanelEquipmentSelection
  gloves: PanelEquipmentSelection
  accessoryOne: PanelEquipmentSelection
  accessoryTwo: PanelEquipmentSelection
}

export interface PanelStatModifier {
  id: string
  value: number
  isPercent: boolean
}

export type PanelAttributeContributionTarget = 'hp' | 'attack' | 'physicalDamageReduction' | 'fireDamageReduction' | 'healingReceived' | 'defenseDamageReduction'

export interface PanelAttributeContribution {
  source: 'strength' | 'agility' | 'intellect' | 'will' | 'defense'
  target: PanelAttributeContributionTarget
  value: number
  isPercent: boolean
}

export interface PanelSetEffect {
  id: string
  requiredPieces: number
  pieceCount: number
  equipmentId: string
}

export interface PanelStats {
  strength: number
  agility: number
  intellect: number
  will: number
  hp: number
  defense: number
  attack: number
  modifiers: PanelStatModifier[]
  attributeContributions: PanelAttributeContribution[]
  setEffects: PanelSetEffect[]
}
