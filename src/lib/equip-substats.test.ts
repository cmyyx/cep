import { describe, expect, it } from 'vitest'
import { equipSubAttrKey, equipSubAttrsById } from './equip-substats'

describe('equipSubAttrsById', () => {
  it('maps five-star equip ids to their sub-attribute keys', () => {
    // 50式应龙短刃·壹型: sub1 '41+32' → '41' (智识), sub2 '39+21' → '39' (力量),
    // special 'AllSkillDamageIncrease+27.6%' → 'AllSkillDamageIncrease'
    const attrs = equipSubAttrsById.get('item_equip_t4_suit_atk02_edc_05')
    expect(attrs).toEqual({ sub1: '41', sub2: '39', special: 'AllSkillDamageIncrease' })
  })

  it('omits slots without data', () => {
    // 点剑定位信标 sub2 为空。
    const attrs = equipSubAttrsById.get('item_equip_t4_suit_phy01_edc_01')
    expect(attrs?.sub1).toBe('39')
    expect(attrs?.sub2).toBeUndefined()
  })

  it('returns an empty string for unknown or non-five-star ids', () => {
    expect(equipSubAttrKey('item_equip_t0_parts_tundra01_body_01', 'sub1')).toBe('')
    expect(equipSubAttrKey('not-a-real-id', 'special')).toBe('')
  })
})
