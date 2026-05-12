/** 角色攻略数据完整类型 */

// ---- 基本信息 ----

export interface CharacterStats {
  strength: string
  agility: string
  intellect: string
  will: string
  attack: string
  hp: string
}

// ---- 技能 ----

export interface SkillDataRow {
  name: string
  /** 12级数值数组 (Lv1~Lv9, M1~M3) */
  values: string[]
}

export interface SkillDataTable {
  title: string
  rows: SkillDataRow[]
}

export interface CharacterSkill {
  name: string
  description: string
  icon: string
  type: string
  dataTables: SkillDataTable[]
}

// ---- 天赋 / 基建技能 / 潜能 ----

export interface SimpleEntry {
  name: string
  description: string
  icon: string
}

export interface PotentialEntry {
  name: string
  description: string
}

// ---- 材料 ----

export type EliteLevel = 'elite1' | 'elite2' | 'elite3' | 'elite4'

export interface CharacterMaterials {
  elite1: string[]
  elite2: string[]
  elite3: string[]
  elite4: string[]
}

// ---- 攻略推荐 ----

export interface GuideEquipEntry {
  name: string
  icon: string
  note: string
  rarity: number | null
}

export interface GuideEquipRow {
  weapons: GuideEquipEntry[]
  equipment: (GuideEquipEntry | null)[]
}

export interface TeamSlotOption {
  name: string
  tag: string
  weapons: GuideEquipEntry[]
  equipment: GuideEquipEntry[]
}

export interface TeamSlot {
  name: string
  note: string
  options: TeamSlotOption[]
}

export interface GuideAttribution {
  role: string
  name: string
  url: string
  note: string
}

export interface CharacterGuide {
  equipRows: GuideEquipRow[]
  analysis: string
  teamTips: string
  operationTips: string
  teamSlots: TeamSlot[]
  attributions: GuideAttribution[]
}

// ---- 顶层完整类型 ----

export interface CharacterGuideData {
  id: string
  name: string
  rarity: number
  element: string
  weaponType: string
  mainAbility: string
  subAbility: string
  profession: string
  stats: CharacterStats
  skills: CharacterSkill[]
  talents: SimpleEntry[]
  baseSkills: SimpleEntry[]
  potentials: PotentialEntry[]
  materials: CharacterMaterials
  guide: CharacterGuide
}
