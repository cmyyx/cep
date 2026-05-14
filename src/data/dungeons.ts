import type { Dungeon } from '@/types/matrix'

/** Parse region name from dungeon name (format: "{region}·{dungeon}") */
export function getRegion(dungeon: Dungeon): string {
  return dungeon.name.split('·')[0] ?? dungeon.name
}

/** Get unique regions in order of first appearance */
export function getRegions(dungeonsArr: Dungeon[]): string[] {
  const seen = new Set<string>()
  const regions: string[] = []
  for (const d of dungeonsArr) {
    const r = getRegion(d)
    if (!seen.has(r)) {
      seen.add(r)
      regions.push(r)
    }
  }
  return regions
}

/** Parse sub-region name from dungeon name (format: "{region}·{subRegion}") */
export function getSubRegion(dungeon: Dungeon): string {
  return dungeon.name.split('·')[1] ?? dungeon.name
}

/** Get all unique sub-regions for a given region, in order of first appearance */
export function getSubRegions(dungeonsArr: Dungeon[], region: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const d of dungeonsArr) {
    if (getRegion(d) !== region) continue
    const s = getSubRegion(d)
    if (!seen.has(s)) {
      seen.add(s)
      result.push(s)
    }
  }
  return result
}

export const dungeons: Dungeon[] = [
  {
    id: 'hub',
    name: '四号谷地·枢纽区',
    s2Pool: [
      '攻击提升', '灼热伤害提升', '电磁伤害提升', '寒冷伤害提升',
      '自然伤害提升', '源石技艺提升', '终结技充能效率提升', '法术伤害提升',
    ],
    s3Pool: ['强攻', '压制', '追袭', '粉碎', '流转', '效益', '巧技', '迸发'],
  },
  {
    id: 'research',
    name: '四号谷地·源石研究园',
    s2Pool: [
      '攻击提升', '物理伤害提升', '电磁伤害提升', '寒冷伤害提升',
      '自然伤害提升', '暴击率提升', '终结技充能效率提升', '法术伤害提升',
    ],
    s3Pool: ['压制', '追袭', '昂扬', '巧技', '附术', '医疗', '切骨', '效益'],
  },
  {
    id: 'energy',
    name: '四号谷地·供能高地',
    s2Pool: [
      '攻击提升', '生命提升', '物理伤害提升', '灼热伤害提升',
      '自然伤害提升', '暴击率提升', '源石技艺提升', '治疗效率提升',
    ],
    s3Pool: ['追袭', '粉碎', '昂扬', '残暴', '附术', '医疗', '切骨', '流转'],
  },
  {
    id: 'mine',
    name: '四号谷地·矿脉源区',
    s2Pool: [
      '生命提升', '物理伤害提升', '灼热伤害提升', '寒冷伤害提升',
      '自然伤害提升', '暴击率提升', '源石技艺提升', '治疗效率提升',
    ],
    s3Pool: ['强攻', '压制', '巧技', '残暴', '附术', '迸发', '夜幕', '效益'],
  },
  {
    id: 'wuling',
    name: '武陵·武陵城',
    s2Pool: [
      '攻击提升', '生命提升', '电磁伤害提升', '寒冷伤害提升',
      '暴击率提升', '终结技充能效率提升', '法术伤害提升', '治疗效率提升',
    ],
    s3Pool: ['强攻', '粉碎', '残暴', '医疗', '切骨', '迸发', '夜幕', '流转'],
  },
  {
    id: 'wuling-qingbo',
    name: '武陵·清波寨',
    s2Pool: [
      '生命提升', '物理伤害提升', '电磁伤害提升', '寒冷伤害提升',
      '源石技艺提升', '终结技充能效率提升', '法术伤害提升', '治疗效率提升',
    ],
    s3Pool: ['压制', '粉碎', '昂扬', '巧技', '医疗', '切骨', '迸发', '夜幕'],
  },
  {
    id: 'wuling-shoudun',
    name: '武陵·首墩',
    s2Pool: [
      '攻击提升', '物理伤害提升', '灼热伤害提升', '电磁伤害提升',
      '自然伤害提升', '暴击率提升', '终结技充能效率提升', '法术伤害提升',
    ],
    s3Pool: ['强攻', '追袭', '昂扬', '残暴', '附术', '夜幕', '流转', '效益'],
  },
  {
    id: 'wuling-shiyan',
    name: '武陵·试验园区',
    s2Pool: [
      '生命提升', '灼热伤害提升', '电磁伤害提升', '寒冷伤害提升',
      '自然伤害提升', '源石技艺提升', '终结技充能效率提升', '治疗效率提升',
    ],
    s3Pool: ['压制', '粉碎', '巧技', '残暴', '附术', '切骨', '夜幕', '流转'],
  },
]
