import { foresightWeaponData } from '@/generated/data/foresight-weapons'

/**
 * 前瞻 (未上线) 武器 -> 正式 ID / 图标。
 *
 * `src/data/weapons.ts` 里的前瞻条目用 `preview:<名称>` 作为临时 ID (没有图标),
 * 生成器按 **武器类型 + 稀有度 + 三个宝石标签** 把它们与客户端前瞻表里的正式 ID
 * 匹配 (`scripts/lib/generate-foresight.ts`), 唯一命中时这里就能给出真图标。
 *
 * 两把标签完全相同的双手剑 (`玉中身` / `悠久传承`) 只会得到 ambiguous, 需要人工确认,
 * 在那之前保持原有的占位显示。
 */
const ICON_BY_PREVIEW_ID = new Map<string, string>(
  foresightWeaponData.weapons
    .filter((weapon) => weapon.previewMatch === 'unique' && weapon.previewCandidates.length === 1)
    .map((weapon) => [weapon.previewCandidates[0], weapon.iconId]),
)

/** 前瞻条目的图标 ID (`preview:<名称>` -> 正式 iconId); 未匹配或歧义时返回 undefined。 */
export function foresightWeaponIconId(previewId: string): string | undefined {
  return ICON_BY_PREVIEW_ID.get(previewId)
}

/** 正式 ID -> 图标 ID, 供武器库按正式 ID 渲染时复用。 */
export function foresightIconIdByWeaponId(weaponId: string): string | undefined {
  return foresightWeaponData.weapons.find((weapon) => weapon.id === weaponId)?.iconId
}
