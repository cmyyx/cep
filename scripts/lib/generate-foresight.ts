// 前瞻 (前瞻, 未上线) 武器的识别与核查 —— 供同步流程使用, **不产出独立数据文件**。
//
// 前瞻状态本身是 `src/data/weapons.ts` 里的 `source: 'preview'` 字段 (同步自动维护),
// 名字进 `src/generated/i18n/weapons/*` (与已上线武器同一份产物), 图标进 wiki assets,
// 因此这里只做: 判定 + 与前台条目匹配 + 把正式 id 交给迁移 (migrate-foresight-weapons.ts)。
//
// 判定与数据来源全部是客户端表:
//   - WeaponBasicTable.json              已上线武器集合 (80 条) —— 不含 id 即前瞻
//   - ForesightWeaponTable.json          前瞻/在售武器条目 (含 skIds / iconId / stageMaterials)
//   - ForesightWeaponGemwishlistTable.json 前瞻武器许愿单 —— 独立交叉验证
//   - I18nTextTable_*.json               多语言文本 (前瞻内容通常还没有文本)
// ================================================================================

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import { loadAllTextTables, SUPPORTED_LOCALES } from './stat-mapping'
import { cleanWikiText } from './wiki-builder-utils'
import { weapons } from '../../src/data/weapons'
import type { ForesightData, ForesightWeaponEntry } from '../../src/types/foresight'

interface StageMaterials {
  upBrkIds?: unknown[]
  upBrkCnt?: unknown[]
  upColIds?: unknown[]
  upColCnt?: unknown[]
  upExpIds?: unknown[]
  upExpCnt?: unknown[]
  upGoldIds?: unknown[]
  upGoldCnt?: unknown[]
}

interface ForesightWeaponRow {
  name?: { id?: unknown }
  iconId?: unknown
  rarity?: unknown
  wpnType?: unknown
  tgtLv?: unknown
  gemTagIds?: unknown
  skIds?: unknown
  stageMaterials?: Record<string, StageMaterials>
}

export interface ForesightSources {
  /** WeaponBasicTable.json: 已上线武器集合 */
  weaponBasicTable: Record<string, unknown>
  /** ForesightWeaponTable.json */
  foresightWeaponTable: Record<string, ForesightWeaponRow>
  /** ForesightWeaponGemwishlistTable.json */
  gemwishlistTable: Record<string, ForesightWeaponRow>
  /** I18nTextTable 全语言 (id -> 文本) */
  textTables: Record<string, Record<string, string>>
  /** `src/data/weapons.ts` 的条目 (只用 source==='preview' 的那几条做匹配) */
  weapons: PreviewWeaponRow[]
}

/** CEP 前瞻条目所需字段 (`src/types/matrix.ts` 的子集)。 */
export interface PreviewWeaponRow {
  id: string
  name: string
  rarity: number
  type: string
  primaryStat: string | null
  elementalDamage: string | null
  specialAbility: string | null
  source?: 'game' | 'preview'
}

/** 武器类型中文名 -> 客户端 wpnType (与 wiki enum weaponTypes 一致)。 */
const WEAPON_TYPE_BY_NAME: Record<string, number> = {
  单手剑: 1,
  施术单元: 2,
  双手剑: 3,
  长柄武器: 5,
  手铳: 6,
}

/** CEP 的 `gat_passive_attr_wisd` / `gst_passive_keyword` -> 客户端 gemTagId `attr_wisd` / `keyword`。 */
function clientTag(cepTag: string | null): string | null {
  if (!cepTag) return null
  const stripped = cepTag.replace(/^ga?t_passive_/, '').replace(/^gst_passive_/, '')
  return stripped.length > 0 ? stripped : null
}

/** 前瞻条目 <-> 正式 ID 的匹配键: 类型 + 稀有度 + 三个 gem 标签。 */
function matchKey(type: number | null, rarity: number | null, tags: string[]): string {
  return [type ?? '', rarity ?? '', [...tags].sort().join('|')].join('#')
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : []
}

/** 汇总 `stageMaterials` 里 4 类消耗 (突破/合成/经验/金币) 为 [itemId, count]。 */
export function aggregateStageMaterials(stages: Record<string, StageMaterials> | undefined): Array<[string, number]> {
  const totals = new Map<string, number>()
  const add = (ids: unknown[] | undefined, counts: unknown[] | undefined) => {
    if (!Array.isArray(ids) || !Array.isArray(counts)) return
    ids.forEach((id, index) => {
      const count = numeric(counts[index])
      if (count === null || count <= 0) return
      const key = String(id)
      totals.set(key, (totals.get(key) ?? 0) + count)
    })
  }
  for (const stage of Object.values(stages ?? {})) {
    add(stage.upBrkIds, stage.upBrkCnt)
    add(stage.upColIds, stage.upColCnt)
    add(stage.upExpIds, stage.upExpCnt)
    add(stage.upGoldIds, stage.upGoldCnt)
  }
  return [...totals.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
}

/**
 * 前瞻名文本: 前瞻表里的 `name.id` 与 `I18nTextTable` 不同源 (实测同批已上线武器
 * 的这两个 id 也不同), 所以这里只在文本表里真的存在时取值, 否则返回 null。
 * 全程用字符串 id (`parseJsonSafe` 无损), 避免 int64 精度丢失。
 */
function resolveNames(row: ForesightWeaponRow, textTables: ForesightSources['textTables']): Record<string, string> | null {
  const id = row.name?.id === undefined ? '' : String(row.name.id)
  if (!id) return null
  const names: Record<string, string> = {}
  for (const locale of SUPPORTED_LOCALES) {
    const text = textTables[locale]?.[id]
    if (typeof text === 'string' && text.length > 0) names[locale] = cleanWikiText(text)
  }
  return Object.keys(names).length > 0 ? names : null
}

/** 组装前瞻武器数据。纯函数, 便于 fixture 测试。 */
export function buildForesightData(sources: ForesightSources): ForesightData {
  const { weaponBasicTable, foresightWeaponTable, gemwishlistTable, textTables } = sources
  const issues: string[] = []

  const enteredIds = Object.keys(foresightWeaponTable).filter((id) => weaponBasicTable[id] === undefined).sort()
  const wishlistIds = Object.keys(gemwishlistTable).sort()

  // 两个独立判据必须一致: WeaponBasicTable 缺条目 <-> 出现在许愿单
  const onlyEntered = enteredIds.filter((id) => !wishlistIds.includes(id))
  const onlyWishlist = wishlistIds.filter((id) => !enteredIds.includes(id))
  if (onlyEntered.length > 0) issues.push(`不在正式表但不在许愿单: ${onlyEntered.join(', ')}`)
  if (onlyWishlist.length > 0) issues.push(`在许愿单但已在正式表(应视为已上线): ${onlyWishlist.join(', ')}`)

  const previewRows = (sources.weapons ?? []).filter((weapon) => weapon.source === 'preview')
  const previewByName = new Map<string, PreviewWeaponRow[]>()
  for (const row of previewRows) {
    previewByName.set(row.name, [...(previewByName.get(row.name) ?? []), row])
  }
  const previewByKey = new Map<string, PreviewWeaponRow[]>()
  for (const row of previewRows) {
    const key = matchKey(WEAPON_TYPE_BY_NAME[row.type] ?? null, row.rarity, [clientTag(row.primaryStat), clientTag(row.elementalDamage), clientTag(row.specialAbility)].filter((tag): tag is string => tag !== null))
    previewByKey.set(key, [...(previewByKey.get(key) ?? []), row])
  }

  const weapons: ForesightWeaponEntry[] = enteredIds.map((id) => {
    const row = foresightWeaponTable[id]
    const iconId = String(row.iconId ?? id)
    // 前瞻表的字段可能与许愿单互为补充, 缺什么就从另一张表取
    const wishlistRow = gemwishlistTable[id] ?? {}
    const pick = <T extends keyof ForesightWeaponRow>(key: T): ForesightWeaponRow[T] => (row[key] ?? wishlistRow[key])
    const names = resolveNames(row, textTables) ?? resolveNames(wishlistRow, textTables)
    if (!names) issues.push(`${id}: 客户端无文本 (ItemTable/I18nTextTable 都没有该条目) → 显示名待上游补`)

    const rarity = numeric(pick('rarity'))
    const weaponType = numeric(pick('wpnType'))
    const gemTagIds = stringList(pick('gemTagIds'))
    // 名字优先: 客户端文本 (CN) 与前台条目同名即同一把; 文本缺失时才退回 类型+稀有度+标签 匹配。
    // 标签只够判定"同类型同属性", 两把完全同标签的双手剑 (玉中身 / 悠久传承) 靠名字才能分开。
    const byName = previewByName.get(names?.['zh-CN'] ?? '') ?? []
    const byKey = previewByKey.get(matchKey(weaponType, rarity, gemTagIds)) ?? []
    const candidates = byName.length > 0 ? byName : byKey
    const matchedEntryIds = candidates.map((candidate) => candidate.id)
    if (matchedEntryIds.length > 1) {
      issues.push(`${id}: 匹配到 ${matchedEntryIds.length} 个前瞻条目 (${matchedEntryIds.join(' / ')}) → 需人工确认谁是谁`)
    } else if (matchedEntryIds.length === 0) {
      issues.push(`${id}: 没有对应的前瞻条目 (src/data/weapons.ts 里 source='preview' 的条目)`)
    }

    return {
      id,
      isForesight: true as const,
      rarity,
      weaponTypeId: (() => {
        const type = numeric(pick('wpnType'))
        return type === null ? null : String(type)
      })(),
      iconId,
      targetLevel: numeric(pick('tgtLv')),
      gemTagIds,
      skillIds: stringList(pick('skIds')),
      names,
      materials: aggregateStageMaterials(row.stageMaterials ?? wishlistRow.stageMaterials),
      matchedEntryIds,
      match: matchedEntryIds.length === 1 ? 'unique' : matchedEntryIds.length > 1 ? 'ambiguous' : 'none',
    }
  })

  return { weapons, issues }
}

function readTable<T>(akedataPath: string, name: string): T {
  const path = join(akedataPath, 'TableCfg', `${name}.json`)
  if (!existsSync(path)) throw new Error(`generate-foresight: 缺少上游表 ${path}`)
  return parseJsonSafe(path) as T
}

/** 可选读取: 表不存在时返回 undefined (资产管线不该因为缺表而中断整条同步)。 */
function readTableOptional<T>(akedataPath: string, name: string): T | undefined {
  const path = join(akedataPath, 'TableCfg', `${name}.json`)
  return existsSync(path) ? (parseJsonSafe(path) as T) : undefined
}

/** 只取图标 ID, 供资产管线 (convert-icons) 拉取前瞻武器图标。 */
export function readForesightWeaponIconIds(akedataPath: string): string[] {
  const basic = readTableOptional<Record<string, unknown>>(akedataPath, 'WeaponBasicTable')
  const foresight = readTableOptional<Record<string, ForesightWeaponRow>>(akedataPath, 'ForesightWeaponTable')
  if (!basic || !foresight) return []
  return Object.keys(foresight)
    .filter((id) => basic[id] === undefined)
    .map((id) => String(foresight[id]?.iconId ?? id))
    .sort()
}

/** 读取上游表并组装前瞻武器数据 (纯返回, 不写文件)。 */
export function generateForesightData(akedataPath: string): ForesightData {
  return buildForesightData({
    weaponBasicTable: readTable<Record<string, unknown>>(akedataPath, 'WeaponBasicTable'),
    foresightWeaponTable: readTable<Record<string, ForesightWeaponRow>>(akedataPath, 'ForesightWeaponTable'),
    gemwishlistTable: readTable<Record<string, ForesightWeaponRow>>(akedataPath, 'ForesightWeaponGemwishlistTable'),
    textTables: loadAllTextTables(akedataPath),
    weapons: (weapons as PreviewWeaponRow[]),
  })
}

/** 供同步流程打印的摘要。 */
export function describeForesightData(data: ForesightData): string[] {
  const named = data.weapons.filter((weapon) => weapon.names !== null).length
  const matched = data.weapons.filter((weapon) => weapon.match === 'unique').length
  const lines = [
    `前瞻武器: ${data.weapons.length} 把 (${data.weapons.map((weapon) => weapon.id).join(', ')})`,
    `  客户端文本: ${named}/${data.weapons.length}; 前台条目唯一匹配: ${matched}/${data.weapons.length}`,
  ]
  for (const issue of data.issues) lines.push(`  ⚠ ${issue}`)
  return lines
}
