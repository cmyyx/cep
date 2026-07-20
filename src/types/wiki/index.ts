export type WikiCategorySlug = 'characters' | 'weapons' | 'equipment'
export type WikiLocale = 'zh-CN' | 'en' | 'ja' | 'zh-TW'

export type LocalizedText = Record<WikiLocale, string>

export interface WikiRichTextTerm {
  name: LocalizedText
  description: LocalizedText
  styleId: string
}

export interface WikiCategoryMeta {
  slug: WikiCategorySlug
  labelKey: string
  descKey: string
  accentClass: string
  entityCount?: number
}

interface WikiEntitySummaryBase {
  id: string
  category: WikiCategorySlug
  name: LocalizedText
  rarity: number
  imageId: string
}

export interface WikiCharacterSummary extends WikiEntitySummaryBase {
  category: 'characters'
  elementId: string
  professionId: string
  factionId: string
  weaponTypeId: string
  mainAttributeId: string
  subAttributeId: string
}

export interface WikiWeaponSummary extends WikiEntitySummaryBase {
  category: 'weapons'
  weaponTypeId: string
  maxLevel: number
}

export interface WikiEquipmentSummary extends WikiEntitySummaryBase {
  category: 'equipment'
  partTypeId: string
  suitId?: string
  suitName?: LocalizedText
  minimumLevel: number
}

export type WikiEntitySummary =
  | WikiCharacterSummary
  | WikiWeaponSummary
  | WikiEquipmentSummary

export interface WikiStatValue {
  attributeId: string
  value: number
}

export interface WikiCharacterLevel {
  level: number
  breakStage: number
  isBreakthrough: boolean
  stats: WikiStatValue[]
}

export interface WikiSkillLevel {
  level: number
  description: LocalizedText
}

export interface WikiSkillMetric {
  id: string
  label: LocalizedText
}

export interface WikiCharacterSkillLevel {
  level: number
  label: string
  values: string[]
  coolDown?: number
  costValue?: number
  goldCost?: number
  materials?: WikiMaterial[]
}

export interface WikiCharacterSkillVariant {
  id: string
  iconId: string
  metrics: WikiSkillMetric[]
  levels: WikiCharacterSkillLevel[]
}

export interface WikiCharacterSkill {
  id: string
  typeId: string
  name: LocalizedText
  description: LocalizedText
  iconId: string
  metrics: WikiSkillMetric[]
  levels: WikiCharacterSkillLevel[]
  variants?: WikiCharacterSkillVariant[]
}

export interface WikiNamedDescription {
  id: string
  name: LocalizedText
  description: LocalizedText
  iconId?: string
}

export interface WikiCharacterTalent extends WikiNamedDescription {
  breakStage: number
  materials: WikiMaterial[]
}

export interface WikiCharacterAttributeNode {
  id: string
  title: LocalizedText
  description: LocalizedText
  iconId?: string
  breakStage: number
  favorability: number
  stats: WikiStatValue[]
  materials: WikiMaterial[]
}

export interface WikiCharacterLogisticsNode {
  id: string
  breakStage: number
  index: number
  level: number
  materials: WikiMaterial[]
}

export interface WikiCharacterLogisticsSkill extends WikiNamedDescription {
  unlockHint: LocalizedText
}
export interface WikiEquipmentSuitEffect extends WikiNamedDescription {
  requiredPieces: number
}

export type WikiVoiceLanguage = 'zh-CN' | 'en' | 'ja' | 'ko'
export interface WikiCharacterVoiceName {
  language: WikiVoiceLanguage
  original: string
  localized: LocalizedText
}

export type WikiCharacterVoiceNames = WikiCharacterVoiceName[]

export interface WikiCharacterPotential {
  id: string
  name: LocalizedText
  description: LocalizedText
  level: number
  imageIds: string[]
}

export interface WikiMaterial {
  itemId: string
  name: LocalizedText
  iconId: string
  rarity: number
  count: number
}

export interface WikiCraftingRecipe {
  chainId: number
  discount: number
  isDefault: boolean
  materials: WikiMaterial[]
}

export interface WikiCharacterPromotion {
  breakStage: number
  requiredLevel: number
  materials: WikiMaterial[]
}

export interface WikiCharacterImageVariants {
  defaultAvatarId: string
  fullBodyIds: {
    female?: string
    male?: string
    default?: string
  }
}

export interface WikiCharacterDetail {
  id: string
  category: 'characters'
  maxLevel: number
  levels: WikiCharacterLevel[]
  skills: WikiCharacterSkill[]
  talents: WikiCharacterTalent[]
  attributeNodes: WikiCharacterAttributeNode[]
  logisticsNodes: WikiCharacterLogisticsNode[]
  potentials: WikiCharacterPotential[]
  logisticsSkills: WikiCharacterLogisticsSkill[]
  cvNames: WikiCharacterVoiceNames
  promotions: WikiCharacterPromotion[]
  images: WikiCharacterImageVariants
}


export interface WikiWeaponLevel {
  level: number
  baseAttack: number
}

export interface WikiWeaponSkill {
  id: string
  name: LocalizedText
  description: LocalizedText
  levels: WikiSkillLevel[]
}

export interface WikiWeaponBreakthrough {
  stage: number
  requiredLevel: number
  stats: WikiStatValue[]
  materials: WikiMaterial[]
}

export interface WikiWeaponDetail {
  id: string
  category: 'weapons'
  maxLevel: number
  levels: WikiWeaponLevel[]
  breakthroughs: WikiWeaponBreakthrough[]
  skills: WikiWeaponSkill[]
}

export interface WikiEquipmentStat {
  attributeId: string
  values: number[]
  displayValues?: string[]
}

export interface WikiEquipmentDetail {
  id: string
  category: 'equipment'
  stats: WikiEquipmentStat[]
  suitEffects: WikiEquipmentSuitEffect[]
  craftingRecipes: WikiCraftingRecipe[]
}

export type WikiEntityDetail =
  | WikiCharacterDetail
  | WikiWeaponDetail
  | WikiEquipmentDetail

export type WikiCharacterDetailMap = Record<string, WikiCharacterDetail>
export type WikiWeaponDetailMap = Record<string, WikiWeaponDetail>
export type WikiEquipmentDetailMap = Record<string, WikiEquipmentDetail>

export type WikiEnumGroup =
  | 'attributes'
  | 'elements'
  | 'professions'
  | 'factions'
  | 'weaponTypes'
  | 'equipmentParts'
  | 'skillTypes'

export type WikiEnumLabels = Record<WikiEnumGroup, Record<string, LocalizedText>>
