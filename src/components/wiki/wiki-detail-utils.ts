import type { WikiEquipmentStat, WikiLocale, WikiWeaponLevel } from '@/types/wiki'
import { localizeText } from '@/lib/wiki-locale-detail'

type LocaleText = string | { 'zh-CN': string; en: string; ja: string; 'zh-TW': string }

export const WIKI_SCROLL_DURATION_MS = 420

export function easeWikiScroll(progress: number): number {
  return 1 - (1 - progress) ** 3
}

/** Collapsed level tables show the highest level present in the data (not a hardcoded 90). */
function filterTopLevel<T extends { level: number }>(levels: readonly T[]): T[] {
  const topLevel = levels.at(-1)?.level
  return topLevel === undefined ? [] : levels.filter((level) => level.level === topLevel)
}

export function getVisibleCharacterLevels<T extends { level: number }>(levels: T[], showAll: boolean) {
  return showAll ? levels : filterTopLevel(levels)
}

export function getVisibleWeaponLevels(levels: WikiWeaponLevel[], showAll: boolean) {
  return showAll ? levels : filterTopLevel(levels)
}

export function getVisibleSkillLevels<T extends { level: number }>(levels: T[], showAll: boolean) {
  return showAll ? levels : levels.slice(-1)
}

export function getVoiceActorDisplayName(voice: { original: string; localized: LocaleText }, locale: WikiLocale): string {
  return voice.original || localizeText(voice.localized, locale) || '—'
}

/**
 * 展示层数值精度收敛: 整数原样输出, 其余保留两位小数并去掉尾随零。
 * 上游数据带 5-8 位小数 (91.85567 / 46.32737219), 直接渲染会撑宽表格且无法与游戏内面板核对。
 * 完整精度由调用方放进 `title` 属性保留。
 */
export function formatWikiNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(2)))
}

/**
 * 装备属性值是剥掉前缀后的字符串, 可能带 `%` 等后缀 (`6.6%`), 仅格式化开头的数值部分。
 * 非数值开头的文本原样返回。
 */
export function formatWikiStatText(text: string): string {
  const match = /^(-?\d+(?:\.\d+)?)(.*)$/.exec(text)
  if (!match) return text
  return `${formatWikiNumber(Number(match[1]))}${match[2]}`
}

export function getWidestTableValue(values: readonly unknown[]): string {
  return values.reduce<string>((widest, value) => {
    const text = value === null || value === undefined || value === '' ? '—' : String(value)
    return text.length > widest.length ? text : widest
  }, '—')
}

export function getAdjacentSpans<T>(values: readonly T[]): number[] {
  const spans = Array<number>(values.length).fill(0)
  let start = 0
  while (start < values.length) {
    let end = start + 1
    while (end < values.length && Object.is(values[end], values[start])) end += 1
    spans[start] = end - start
    start = end
  }
  return spans
}

export function getSkillDisplayVariants<T extends { variants?: readonly unknown[] }>(skill: T): NonNullable<T['variants']> {
  return (skill.variants ?? []) as NonNullable<T['variants']>
}

// ── 章节可见性 ───────────────────────────────────────────────────────────────
// 详情页正文与 TOC 必须使用同一判定, 否则空数据会渲染空区块 / 留下死锚点。

/** Sections rendered by EquipmentDetailContent, in document order. */
export function getEquipmentDetailSectionIds(detail: {
  suitEffects: readonly unknown[]
}): string[] {
  return [
    'overview',
    'stats',
    ...(detail.suitEffects.length > 0 ? ['suit-effects'] : []),
    'crafting-materials',
  ]
}

/** Sections rendered by CharacterDetailContent, in document order. */
export function getCharacterDetailSectionIds(detail: {
  attributeNodes: readonly unknown[]
  equipmentNodes: readonly unknown[]
  logisticsSkills: readonly unknown[]
}): string[] {
  return [
    'overview',
    'level-data',
    ...(detail.attributeNodes.length > 0 ? ['attribute-nodes'] : []),
    ...(detail.equipmentNodes.length > 0 ? ['equipment-nodes'] : []),
    'skills',
    'talents',
    'potentials',
    ...(detail.logisticsSkills.length > 0 ? ['logistics-skills'] : []),
    'promotions',
  ]
}

// ── 后勤技能档位 ─────────────────────────────────────────────────────────────

export interface WikiLogisticsTier<Skill, Node> {
  skill: Skill
  /** 该档位的升级材料节点; 数据缺档时为 undefined。 */
  node?: Node
}

export interface WikiLogisticsGroup<Skill, Node> {
  /** 后勤位序号 (upstream `index`)。 */
  index: number
  iconId?: string
  /** 同一后勤位的升级档位 (β/γ), 按 level 升序。 */
  tiers: Array<WikiLogisticsTier<Skill, Node>>
}

/**
 * 后勤技能按后勤位 (index) 分组, 位内按档位 (level) 升序。
 *
 * 上游每个干员是 2 位 x 2 档 = 4 条 (`摘山煮海·β/·γ`, `多识草木·β/·γ`), 全 29 个干员
 * 结构一致 (管理员 chr_9000 为 0 条)。早期实现只渲染每组的 skills[0], `·γ` 档的名称、
 * 解锁提示与描述被整条丢弃。
 *
 * 升级材料在 logisticsNodes 里同样按 (index, level) 一一对应 —— 只按 index 查找会把两个
 * 档位都指向 level 1 的材料 (6 协议棱柱 vs 12 协议棱柱组), 因此两个键都必须匹配。
 */
export function groupCharacterLogisticsSkills<
  Skill extends { index: number; level: number; iconId?: string },
  Node extends { index: number; level: number },
>(skills: readonly Skill[], nodes: readonly Node[]): Array<WikiLogisticsGroup<Skill, Node>> {
  const groups = new Map<number, Array<WikiLogisticsTier<Skill, Node>>>()
  const ordered = [...skills].sort((left, right) => left.index - right.index || left.level - right.level)
  for (const skill of ordered) {
    const tiers = groups.get(skill.index) ?? []
    tiers.push({
      skill,
      node: nodes.find((node) => node.index === skill.index && node.level === skill.level),
    })
    groups.set(skill.index, tiers)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, tiers]) => ({ index, iconId: tiers.find((tier) => tier.skill.iconId)?.skill.iconId, tiers }))
}

/** Refinement columns rendered by the equipment stat table (+0 … +3). */
export const EQUIPMENT_STAT_LEVELS = [0, 1, 2, 3] as const

/**
 * Some stats only ship a single value (the attribute does not change with refinement).
 * Repeat the last value up to the column count so getAdjacentSpans merges it into one
 * cell spanning +0…+3 instead of leaving three blank columns.
 */
export function getEquipmentStatValues(
  stat: WikiEquipmentStat,
  columns: number = EQUIPMENT_STAT_LEVELS.length,
): Array<string | number> {
  const values: Array<string | number> = stat.displayValues ?? stat.values
  const last = values.at(-1)
  if (last === undefined || values.length >= columns) return values
  return [...values, ...Array.from({ length: columns - values.length }, () => last)]
}

const CHARACTER_LEVEL_STAT_IDS = new Set(['39', '40', '41', '42', '1', '2', '49', '25'])

export function isCharacterLevelStat(attributeId: string): boolean {
  return CHARACTER_LEVEL_STAT_IDS.has(attributeId)
}

// ── 孤岛 props 列式打包 ──────────────────────────────────────────────────────
// 等级/技能表以行对象数组传给客户端孤岛时, 每行重复全部 JSON key 名
// (90 级 x 8 属性 x 3 份载荷拷贝)。构建期打包为列式结构, 孤岛内解包还原,
// 传输链路逐字节不变(不做数值取整)。
// 注意: 这里说的"不取整"只约束打包/解包本身 —— 数据不得在序列化环节失真;
// 渲染时由 formatWikiNumber 收敛显示精度, 两者不冲突。

/** rows 每行 = [level, breakStage, ...values 按 statKeys 对齐, 缺失为 null] */
export interface CharacterLevelsPacked {
  statKeys: string[]
  rows: Array<Array<number | null>>
}

export function packCharacterLevels(
  levels: ReadonlyArray<{
    level: number
    breakStage: number
    stats: ReadonlyArray<{ attributeId: string; value: number }>
  }>,
): CharacterLevelsPacked {
  const statKeys: string[] = []
  for (const level of levels) {
    for (const stat of level.stats) {
      if (!statKeys.includes(stat.attributeId)) statKeys.push(stat.attributeId)
    }
  }
  return {
    statKeys,
    rows: levels.map((level) => [
      level.level,
      level.breakStage,
      ...statKeys.map((id) => level.stats.find((stat) => stat.attributeId === id)?.value ?? null),
    ]),
  }
}

export function unpackCharacterLevels(packed: CharacterLevelsPacked): Array<{
  level: number
  breakStage: number
  stats: Array<{ attributeId: string; value: number }>
}> {
  return packed.rows.map((row) => ({
    level: row[0] ?? 0,
    breakStage: row[1] ?? 0,
    stats: packed.statKeys.flatMap((attributeId, index) => {
      const value = row[index + 2]
      return value === null || value === undefined ? [] : [{ attributeId, value }]
    }),
  }))
}

export interface WeaponLevelsPacked {
  levels: number[]
  baseAttack: number[]
}

export function packWeaponLevels(
  levels: ReadonlyArray<{ level: number; baseAttack: number }>,
): WeaponLevelsPacked {
  return {
    levels: levels.map((level) => level.level),
    baseAttack: levels.map((level) => level.baseAttack),
  }
}

export function unpackWeaponLevels(packed: WeaponLevelsPacked): WikiWeaponLevel[] {
  return packed.levels.map((level, index) => ({
    level,
    baseAttack: packed.baseAttack[index],
  }))
}

/** 技能等级表列式结构; materials 每级 = [itemId, count] 元组数组。 */
export interface SkillLevelsPacked {
  levels: number[]
  labels: string[]
  values: string[][]
  coolDowns: Array<number | null>
  costValues: Array<number | null>
  materials: Array<Array<[string, number]>>
}

export function packSkillLevels(
  levels: ReadonlyArray<{
    level: number
    label: string
    values: string[]
    coolDown?: number
    costValue?: number
    materials?: ReadonlyArray<{ itemId: string; count: number }>
  }>,
): SkillLevelsPacked {
  return {
    levels: levels.map((level) => level.level),
    labels: levels.map((level) => level.label),
    values: levels.map((level) => level.values),
    coolDowns: levels.map((level) => level.coolDown ?? null),
    costValues: levels.map((level) => level.costValue ?? null),
    materials: levels.map((level) => (level.materials ?? []).map((m) => [m.itemId, m.count])),
  }
}

export function unpackSkillLevels(packed: SkillLevelsPacked): Array<{
  level: number
  label: string
  values: string[]
  coolDown?: number
  costValue?: number
  materials: Array<{ itemId: string; count: number }>
}> {
  return packed.levels.map((level, index) => ({
    level,
    label: packed.labels[index],
    values: packed.values[index],
    coolDown: packed.coolDowns[index] ?? undefined,
    costValue: packed.costValues[index] ?? undefined,
    materials: packed.materials[index].map(([itemId, count]) => ({ itemId, count })),
  }))
}
