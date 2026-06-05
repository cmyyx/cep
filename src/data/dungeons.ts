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
    id: 'world_energy_point_group01',
    name: '四号谷地·枢纽区',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_atk', 'gat_passive_attr_firedam', 'gat_passive_attr_pulsedam', 'gat_passive_attr_icedam',
      'gat_passive_attr_naturaldam', 'gat_passive_attr_physpell', 'gat_passive_attr_usp', 'gat_passive_attr_magicdam',
    ],
    s3Pool: ['gst_passive_force', 'gst_passive_tactic', 'gst_passive_combo', 'gst_passive_smash', 'gst_passive_tacafter', 'gst_passive_keyword', 'gst_passive_phyabn', 'gst_passive_burst'],
  },
  {
    id: 'world_energy_point_group02',
    name: '四号谷地·源石研究园',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_atk', 'gat_passive_attr_phydam', 'gat_passive_attr_pulsedam', 'gat_passive_attr_icedam',
      'gat_passive_attr_naturaldam', 'gat_passive_attr_crirate', 'gat_passive_attr_usp', 'gat_passive_attr_magicdam',
    ],
    s3Pool: ['gst_passive_tactic', 'gst_passive_combo', 'gst_passive_spirit', 'gst_passive_phyabn', 'gst_passive_magabn', 'gst_passive_heal', 'gst_passive_crit', 'gst_passive_keyword'],
  },
  {
    id: 'world_energy_point_group04',
    name: '四号谷地·供能高地',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_atk', 'gat_passive_attr_hp', 'gat_passive_attr_phydam', 'gat_passive_attr_firedam',
      'gat_passive_attr_naturaldam', 'gat_passive_attr_crirate', 'gat_passive_attr_physpell', 'gat_passive_attr_heal',
    ],
    s3Pool: ['gst_passive_combo', 'gst_passive_smash', 'gst_passive_spirit', 'gst_passive_break', 'gst_passive_magabn', 'gst_passive_heal', 'gst_passive_crit', 'gst_passive_tacafter'],
  },
  {
    id: 'world_energy_point_group03',
    name: '四号谷地·矿脉源区',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_hp', 'gat_passive_attr_phydam', 'gat_passive_attr_firedam', 'gat_passive_attr_icedam',
      'gat_passive_attr_naturaldam', 'gat_passive_attr_crirate', 'gat_passive_attr_physpell', 'gat_passive_attr_heal',
    ],
    s3Pool: ['gst_passive_force', 'gst_passive_tactic', 'gst_passive_phyabn', 'gst_passive_break', 'gst_passive_magabn', 'gst_passive_burst', 'gst_passive_ult', 'gst_passive_keyword'],
  },
  {
    id: 'world_energy_point_group05',
    name: '武陵·武陵城',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_atk', 'gat_passive_attr_hp', 'gat_passive_attr_pulsedam', 'gat_passive_attr_icedam',
      'gat_passive_attr_crirate', 'gat_passive_attr_usp', 'gat_passive_attr_magicdam', 'gat_passive_attr_heal',
    ],
    s3Pool: ['gst_passive_force', 'gst_passive_smash', 'gst_passive_break', 'gst_passive_heal', 'gst_passive_crit', 'gst_passive_burst', 'gst_passive_ult', 'gst_passive_tacafter'],
  },
  {
    id: 'world_energy_point_group06',
    name: '武陵·清波寨',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_hp', 'gat_passive_attr_phydam', 'gat_passive_attr_pulsedam', 'gat_passive_attr_icedam',
      'gat_passive_attr_physpell', 'gat_passive_attr_usp', 'gat_passive_attr_magicdam', 'gat_passive_attr_heal',
    ],
    s3Pool: ['gst_passive_tactic', 'gst_passive_smash', 'gst_passive_spirit', 'gst_passive_phyabn', 'gst_passive_heal', 'gst_passive_crit', 'gst_passive_burst', 'gst_passive_ult'],
  },
  {
    id: 'world_energy_point_group07',
    name: '武陵·首墩',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_atk', 'gat_passive_attr_phydam', 'gat_passive_attr_firedam', 'gat_passive_attr_pulsedam',
      'gat_passive_attr_naturaldam', 'gat_passive_attr_crirate', 'gat_passive_attr_usp', 'gat_passive_attr_magicdam',
    ],
    s3Pool: ['gst_passive_force', 'gst_passive_combo', 'gst_passive_spirit', 'gst_passive_break', 'gst_passive_magabn', 'gst_passive_ult', 'gst_passive_tacafter', 'gst_passive_keyword'],
  },
  {
    id: 'world_energy_point_group08',
    name: '武陵·试验园区',
    s1Pool: ['gat_passive_attr_str', 'gat_passive_attr_agi', 'gat_passive_attr_wisd', 'gat_passive_attr_will', 'gat_passive_attr_main'],
    s2Pool: [
      'gat_passive_attr_hp', 'gat_passive_attr_firedam', 'gat_passive_attr_pulsedam', 'gat_passive_attr_icedam',
      'gat_passive_attr_naturaldam', 'gat_passive_attr_physpell', 'gat_passive_attr_usp', 'gat_passive_attr_heal',
    ],
    s3Pool: ['gst_passive_tactic', 'gst_passive_smash', 'gst_passive_phyabn', 'gst_passive_break', 'gst_passive_magabn', 'gst_passive_crit', 'gst_passive_ult', 'gst_passive_tacafter'],
  },
  {
    id: 'world_energy_point_group09',
    name: '武陵·藏剑谷',
    s1Pool: ['gat_passive_attr_agi', 'gat_passive_attr_str', 'gat_passive_attr_will', 'gat_passive_attr_wisd', 'gat_passive_attr_main'],
    s2Pool: ['gat_passive_attr_atk', 'gat_passive_attr_hp', 'gat_passive_attr_phydam', 'gat_passive_attr_firedam', 'gat_passive_attr_icedam', 'gat_passive_attr_naturaldam', 'gat_passive_attr_physpell', 'gat_passive_attr_heal'],
    s3Pool: ['gst_passive_force', 'gst_passive_combo', 'gst_passive_spirit', 'gst_passive_phyabn', 'gst_passive_heal', 'gst_passive_crit', 'gst_passive_burst', 'gst_passive_keyword'],
  }
]
