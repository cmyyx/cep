import { foresightWeaponData } from '@/generated/data/foresight-weapons'

/**
 * 前瞻 (未上线) 武器判定。
 *
 * 判定来源是**客户端前瞻表**: `scripts/lib/generate-foresight.ts` 取
 * `ForesightWeaponTable` 里所有不在 `WeaponBasicTable` 的武器 (并用 `ForesightWeaponGemwishlistTable`
 * 交叉验证), 生成 `src/generated/data/foresight-weapons.ts`。
 *
 * 因此前瞻状态是上游自动识别的:
 *   - 新前瞻武器进表 → 同步后自动带徽标 (无需手写 `source`)
 *   - 实装后从 `ForesightWeaponTable` 消失 → 徽标自动消失
 * 手写的 `source: 'preview'` 仍然有效 (公告已出、客户端表还没跟上的那段时间)。
 */
const FORESIGHT_IDS = new Set(foresightWeaponData.weapons.map((weapon) => weapon.id))

/** 客户端前瞻表里的武器 id → 该武器仍处于前瞻 (未上线) 状态。 */
export function isForesightWeapon(weaponId: string): boolean {
  return FORESIGHT_IDS.has(weaponId)
}

/** 全部前瞻武器 id (按 id 排序, 便于调试与测试)。 */
export function foresightWeaponIds(): string[] {
  return [...FORESIGHT_IDS].sort()
}
