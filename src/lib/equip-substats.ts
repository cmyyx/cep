import { equips } from '@/data/equips'

export type EquipSubSlot = 'sub1' | 'sub2' | 'special'

export type EquipSubAttrs = Partial<Record<EquipSubSlot, string>>

/**
 * 装备 id → 精锻属性 key (sub1/sub2/special 的属性标识符)。
 * 数据来自 src/data/equips.ts (旧数据集, 仅覆盖 5★ 装备, id 与 wiki 装备一一对应);
 * 1–4★ 装备无记录, 查询返回空串, 天然不参与属性筛选。
 */
export const equipSubAttrsById: ReadonlyMap<string, EquipSubAttrs> = new Map(
  equips.map((equip) => [
    equip.id,
    {
      ...(equip.sub1?.key ? { sub1: equip.sub1.key } : {}),
      ...(equip.sub2?.key ? { sub2: equip.sub2.key } : {}),
      ...(equip.special?.key ? { special: equip.special.key } : {}),
    },
  ]),
)

/** 装备在指定槽位的属性 key; 无数据 (1–4★ 或未知 id) 返回空串。 */
export function equipSubAttrKey(equipId: string, slot: EquipSubSlot): string {
  return equipSubAttrsById.get(equipId)?.[slot] ?? ''
}
