/**
 * MaaEND 无暇基质库存 解析器。
 *
 * 上游格式（MaaEND `essence_inventory.schema.json`）：一个数组，每项是一组
 * 词条组合：
 *
 *   { weapon_ids: string[], essences: [{ levels: [1-6, 1-6, 1-3], count: number }] }
 *
 * 语义：`weapon_ids` 是该词条组合精确匹配的全部武器（适配关系，不表示已装备）；
 * `essences[].count` 是该等级组合的持有数量。CEP 只记录"该武器是否有适配基质"
 * 的布尔状态，因此等级与数量仅用于摘要展示，不参与落库。
 */

import { z } from 'zod'
import { weapons } from '@/data/weapons'

const WEAPON_ID_PATTERN = /^wpn_[a-z0-9_]+$/
const KNOWN_WEAPON_IDS = new Set(weapons.map((weapon) => weapon.id))

const maaEndEssenceSchema = z.strictObject({
  // 按 基础属性 / 附加属性 / 技能属性 顺序的三级词条等级
  levels: z.tuple([z.int().min(1).max(6), z.int().min(1).max(6), z.int().min(1).max(3)]),
  count: z.int().min(1),
})

const maaEndEntrySchema = z.strictObject({
  // 上游保证去重升序；这里不强制顺序，重复项由 Set 折叠
  weapon_ids: z.array(z.string().regex(WEAPON_ID_PATTERN)).min(1),
  essences: z.array(maaEndEssenceSchema).min(1),
})

const maaEndInventorySchema = z.array(maaEndEntrySchema)

export interface MaaEndEssenceSummary {
  /** 词条组合组数 */
  groupCount: number
  /** 基质总数（各组 count 之和；不乘武器数） */
  essenceCount: number
  /** 命中当前数据库的武器 id（升序、去重） */
  weaponIds: string[]
  /** 已知库中没有的武器 id（升序、去重），导入时会被跳过 */
  unknownWeaponIds: string[]
}

/**
 * Strict validation + folding into a weapon-id set.
 *
 * Returns null when the payload does not match the MaaEND schema — the caller
 * must not guess, since a wrong guess would overwrite real marks.
 */
export function parseMaaEndEssence(value: unknown): MaaEndEssenceSummary | null {
  const parsed = maaEndInventorySchema.safeParse(value)
  if (!parsed.success) return null

  const known = new Set<string>()
  const unknown = new Set<string>()
  let essenceCount = 0

  for (const entry of parsed.data) {
    for (const weaponId of entry.weapon_ids) {
      if (KNOWN_WEAPON_IDS.has(weaponId)) known.add(weaponId)
      else unknown.add(weaponId)
    }
    for (const essence of entry.essences) essenceCount += essence.count
  }

  return {
    groupCount: parsed.data.length,
    essenceCount,
    weaponIds: [...known].sort(),
    unknownWeaponIds: [...unknown].sort(),
  }
}
