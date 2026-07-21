export interface Weapon {
  id: string
  /**
   * 游戏内 ItemTable.iconId，用于获取图标资源。
   * 与 id 不同时表示游戏原始资源交叉指向（如 wpn_funnel_0008/0010）。
   * 缺失时回退到 id。同步脚本会自动检测/补充/纠正该字段。
   */
  iconId?: string
  name: string
  rarity: 3 | 4 | 5 | 6
  type: string
  /** null means this slot places no constraint on a dungeon roll. */
  primaryStat: string | null
  elementalDamage: string | null
  specialAbility: string | null
  chars: string[]
  /** 'game' = from game client asset unpacking; 'preview' = from official pre-release announcements. */
  source?: 'game' | 'preview'
}

export interface Dungeon {
  id: string
  name: string
  s1Pool: string[]
  s2Pool: string[]
  s3Pool: string[]
}

export const PRIMARY_STATS = [
  '力量提升',
  '敏捷提升',
  '智识提升',
  '意志提升',
  '主能力提升',
] as const

export type PrimaryStat = (typeof PRIMARY_STATS)[number]
