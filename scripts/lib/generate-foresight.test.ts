import { describe, expect, it } from 'vitest'
import { aggregateStageMaterials, buildForesightData, type ForesightSources } from './generate-foresight'

const EMPTY_TEXTS = { 'zh-CN': {}, en: {}, ja: {}, 'zh-TW': {} }

/** 精简自真实上游数据 (1.6 前瞻): claym_0018 未上线, sword_0023 已上线。 */
function sources(overrides: Partial<ForesightSources> = {}): ForesightSources {
  return {
    weaponBasicTable: { wpn_sword_0023: {} },
    foresightWeaponTable: {
      wpn_claym_0018: {
        name: { id: '-1414695695683300716' },
        iconId: 'wpn_claym_0018',
        rarity: '6',
        wpnType: '3',
        tgtLv: '90',
        gemTagIds: ['attr_wisd', 'attr_icedam', 'keyword'],
        skIds: ['wpn_attr_wisd_high', 'wpn_sp_attr_crystdam_high', 'sk_wpn_claym_0018'],
        stageMaterials: {
          '1': {
            upBrkIds: ['item_weapon_break_low'], upBrkCnt: ['23'],
            upColIds: ['item_plant_spcstone_1_1', 'item_plant_spcstone_1_2'], upColCnt: ['3', '5'],
            upExpIds: ['item_weapon_expcard_low'], upExpCnt: ['1453'],
            upGoldIds: ['item_gold'], upGoldCnt: ['39710'],
          },
          '2': { upColIds: ['item_plant_spcstone_1_1'], upColCnt: ['7'] },
        },
      },
      wpn_sword_0023: { name: { id: '1' }, iconId: 'wpn_sword_0023', rarity: '5', wpnType: '1', tgtLv: '90' },
    },
    gemwishlistTable: {
      wpn_claym_0018: { iconId: 'wpn_claym_0018', rarity: '6', wpnType: '3', tgtLv: '90' },
    },
    textTables: EMPTY_TEXTS,
    // CEP 前台条目 (只用 source='preview' 的做匹配): 标签三元组与 claym_0018 完全一致
    weapons: [{
      id: 'preview:玉中身',
      name: '玉中身',
      rarity: 6,
      type: '双手剑',
      primaryStat: 'gat_passive_attr_wisd',
      elementalDamage: 'gat_passive_attr_icedam',
      specialAbility: 'gst_passive_keyword',
      source: 'preview',
    }],
    ...overrides,
  }
}

describe('aggregateStageMaterials', () => {
  it('sums each cost family across stages and sorts by count', () => {
    const materials = aggregateStageMaterials({
      '1': { upBrkIds: ['item_a'], upBrkCnt: ['2'], upGoldIds: ['item_gold'], upGoldCnt: ['100'] },
      '2': { upBrkIds: ['item_a'], upBrkCnt: ['3'], upGoldIds: ['item_gold'], upGoldCnt: ['50'] },
    })
    expect(materials).toEqual([['item_gold', 150], ['item_a', 5]])
  })

  it('ignores mismatched or missing id/count arrays', () => {
    expect(aggregateStageMaterials({ '1': { upBrkIds: ['item_a'], upBrkCnt: [] }, '2': { upColCnt: ['3'] } })).toEqual([])
    expect(aggregateStageMaterials(undefined)).toEqual([])
  })
})

describe('buildForesightData', () => {
  it('keeps only weapons missing from WeaponBasicTable', () => {
    const { weapons } = buildForesightData(sources())
    expect(weapons.map((weapon) => weapon.id)).toEqual(['wpn_claym_0018'])
    expect(weapons[0]).toMatchObject({
      isForesight: true,
      rarity: 6,
      weaponTypeId: '3',
      iconId: 'wpn_claym_0018',
      targetLevel: 90,
      gemTagIds: ['attr_wisd', 'attr_icedam', 'keyword'],
      skillIds: ['wpn_attr_wisd_high', 'wpn_sp_attr_crystdam_high', 'sk_wpn_claym_0018'],
    })
  })

  it('reports missing client text instead of inventing a name', () => {
    const { weapons, issues } = buildForesightData(sources())
    expect(weapons[0].names).toBeNull()
    expect(issues.some((issue) => issue.includes('wpn_claym_0018') && issue.includes('无文本'))).toBe(true)
  })

  it('fills names from the text table when the id resolves', () => {
    const withText = sources({ textTables: { ...EMPTY_TEXTS, 'zh-CN': { '-1414695695683300716': '雷斑二型' } } })
    const { weapons, issues } = buildForesightData(withText)
    expect(weapons[0].names).toEqual({ 'zh-CN': '雷斑二型' })
    expect(issues.some((issue) => issue.includes('无文本'))).toBe(false)
  })

  it('flags both directions of a mismatch between the two judgements', () => {
    const mismatch = sources({
      // sword_0023 已上线却出现在许愿单; claym_0018 未上线却不在许愿单
      gemwishlistTable: { wpn_sword_0023: { iconId: 'wpn_sword_0023' } },
    })
    const { issues } = buildForesightData(mismatch)
    expect(issues.some((issue) => issue.includes('不在许愿单') && issue.includes('wpn_claym_0018'))).toBe(true)
    expect(issues.some((issue) => issue.includes('已在正式表') && issue.includes('wpn_sword_0023'))).toBe(true)
  })

  it('matches the CEP preview entry by type + rarity + gem tags', () => {
    const { weapons, issues } = buildForesightData(sources())
    expect(weapons[0].previewCandidates).toEqual(['preview:玉中身'])
    expect(weapons[0].previewMatch).toBe('unique')
    expect(issues.some((issue) => issue.includes('没有对应的前瞻条目'))).toBe(false)
  })

  it('uses the resolved client name to pick between twins with identical tags', () => {
    // 两把完全同标签的双手剑: 只有名字能把它们分开 (客户端文本 CN = 玉中身)
    const twin = { id: 'preview:悠久传承', name: '悠久传承', rarity: 6, type: '双手剑', primaryStat: 'gat_passive_attr_wisd', elementalDamage: 'gat_passive_attr_icedam', specialAbility: 'gst_passive_keyword', source: 'preview' as const }
    const withText = sources({
      textTables: { ...EMPTY_TEXTS, 'zh-CN': { '-1414695695683300716': '玉中身' } },
      weapons: [...sources().weapons, twin],
    })
    const matched = buildForesightData(withText)
    expect(matched.weapons[0].previewCandidates).toEqual(['preview:玉中身'])
    expect(matched.weapons[0].previewMatch).toBe('unique')
  })

  it('falls back to the tag triple when the client text is missing, and reports no match', () => {
    // 文本缺失 (旧快照) 时同名匹配失效 -> 退回标签; 两个同标签条目 -> ambiguous
    const noText = { ...sources(), textTables: EMPTY_TEXTS, weapons: [
      sources().weapons[0],
      { ...sources().weapons[0], id: 'preview:悠久传承', name: '悠久传承' },
    ] }
    const ambiguous = buildForesightData(noText)
    expect(ambiguous.weapons[0].previewMatch).toBe('ambiguous')
    expect(ambiguous.issues.some((issue) => issue.includes('需人工确认'))).toBe(true)

    const none = buildForesightData(sources({ weapons: [] }))
    expect(none.weapons[0].previewMatch).toBe('none')
    expect(none.issues.some((issue) => issue.includes('没有对应的前瞻条目'))).toBe(true)
  })

  it('aggregates the weapon upgrade materials', () => {
    const { weapons } = buildForesightData(sources())
    expect(weapons[0].materials).toEqual([
      ['item_gold', 39710],
      ['item_weapon_expcard_low', 1453],
      ['item_weapon_break_low', 23],
      ['item_plant_spcstone_1_1', 10],
      ['item_plant_spcstone_1_2', 5],
    ])
  })
})
