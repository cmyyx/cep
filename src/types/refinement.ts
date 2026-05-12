/** 解析后的属性值（sub1 / sub2 / special 统一格式） */
export interface ParsedStat {
  /** 属性名，如 "意志"、"终结技充能效率" */
  stat: string
  /** 数值 */
  value: number
  /** 单位（"" 或 "%"） */
  unit: string
  /** 原始展示字符串，如 "意志+32"、"终结技充能效率+24.6%" */
  display: string
}

/** 可精锻的属性槽位 */
export type SlotKey = 'sub1' | 'sub2' | 'special'

/** 装备 */
export interface Equip {
  /** 唯一标识，kebab-case */
  id: string
  /** 装备名 */
  name: string
  /** 所属套组 */
  setName: string
  /** 稀有度（目前仅 5 星） */
  rarity: 5
  /** 装备类型 */
  type: '配件' | '护手' | '护甲'
  /** 副属性 1 */
  sub1: ParsedStat | null
  /** 副属性 2（可能为空） */
  sub2: ParsedStat | null
  /** 特殊属性 */
  special: ParsedStat | null
  /** 制造材料 */
  material: string
  /** 图片文件名（不含扩展名） */
  imageId: string
}

/** 装备套组 */
export interface EquipSetGroup {
  setName: string
  equips: Equip[]
}

/** 精锻推荐候选 */
export interface RefinementCandidate {
  /** 候选装备 */
  equip: Equip
  /** 匹配上的属性值（可能来自候选装备的 sub1/sub2/special 中任意一个） */
  matchAttr: ParsedStat
  /** 来自候选装备的哪个槽位 */
  matchSlotKey: SlotKey
}

/** 单个属性槽位的精锻推荐结果 */
export interface SlotRecommendation {
  slotKey: SlotKey
  /** 目标属性（选中的装备在该槽位的属性值） */
  targetAttr: ParsedStat | null
  /** 是否推荐自身（无可超越的候选时） */
  recommendSelf: boolean
  /** 右上角展示的最高属性值 display */
  topValueDisplay: string
  /** 候选列表（按 value 降序，自身排第一当 recommendSelf 时） */
  candidates: RefinementCandidate[]
  /**
   * 材料筛选提示：
   * - 空字符串：无提示
   * - 'noCandidate'：筛选后无任何候选
   * - 'mayMissBest'：筛选后最高值 < 未筛选时的最高值
   */
  materialFilterNotice: '' | 'noCandidate' | 'mayMissBest'
  /** 是否存在严格高于目标属性值的候选 */
  hasHigherValues: boolean
}

/** 左侧属性筛选分组 */
export type FilterGroup = 'sub1' | 'sub2' | 'special' | 'material'
