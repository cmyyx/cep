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
// 渲染结果逐字节不变(不做数值取整)。

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
