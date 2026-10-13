/**
 * 前瞻武器 (`ForesightWeaponTable` / `ForesightWeaponGemwishlistTable`)。
 *
 * 前瞻武器用的是**正式 ID** (与已上线武器同一套 ID/图标/数据结构), 区别只在于
 * 上游 `WeaponBasicTable` (已上线武器表) 里还没有它们 —— 所以"前瞻身份"是
 * 生成时算出来的标记, 不是另一个命名空间。
 */
export interface ForesightWeaponEntry {
  /** 正式武器 ID (与 `WeaponBasicTable` 同空间) */
  id: string
  /** 判定依据: 不在 `WeaponBasicTable` 里; 由 Gemwishlist 交叉验证 */
  isForesight: true
  rarity: number | null
  weaponTypeId: string | null
  /** 图标 ID (CDN `sprites/itemiconbig/<iconId>.png` 已有前瞻图标) */
  iconId: string
  /** 客户端的养成目标等级 */
  targetLevel: number | null
  /** 宝石标签 (`attr_*` / `keyword` 等, 与已上线武器同义) */
  gemTagIds: string[]
  /** 技能槽 (前瞻表只给 id; 名字 id 与 `I18nTextTable` 不同源, 解析不出) */
  skillIds: string[]
  /**
   * 多语言显示名。前瞻内容在客户端里还没有任何文本 (无 ItemTable 条目,
   * `I18nTextTable`/`TextTable`/`HotFix` 都查不到这些 id), 所以通常为 null;
   * 上游补文本后这里会自动填上。
   */
  names: Record<string, string> | null
  /** 升级材料汇总 ([itemId, count]) */
  materials: Array<[string, number]>
  /**
   * `src/data/weapons.ts` 里对应的前台条目 id (`preview:名称` 或迁移后的正式 id)。
   * 匹配优先按名字 (客户端文本 CN == 条目 name), 文本缺失时退回 类型+稀有度+gemTagIds 三元组。
   */
  matchedEntryIds: string[]
  /** 匹配结果: unique=唯一命中可自动处理, ambiguous=多候选待确认, none=没有对应条目 */
  match: 'unique' | 'ambiguous' | 'none'
}

export interface ForesightData {
  weapons: ForesightWeaponEntry[]
  /** 生成时自检: 前瞻判定与许愿单不一致、客户端缺文本等 */
  issues: string[]
}
