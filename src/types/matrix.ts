export interface Weapon {
  id: string
  name: string
  rarity: 4 | 5 | 6
  type: string
  primaryStat: string
  elementalDamage: string
  specialAbility: string
  chars: string[]
  imageId?: string
}

export interface Dungeon {
  id: string
  name: string
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
