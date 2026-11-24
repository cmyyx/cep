/**
 * MaaEND 基质库存解析器。
 *
 * 支持上游两代格式，均以 `tools/schema/essence_inventory.schema.json` 为准：
 *
 * 1. 协议第 1 版（v3.3.0-beta.2 起，当前格式）：
 *
 *      {
 *        "format": "maaend.essence_inventory",
 *        "version": 1,
 *        "updated_at": "…UTC…",
 *        "coverage": { "flawless_gold": { "complete_at": "…" } },
 *        "items": [
 *          { "quality": "flawless_gold", "mark": "lock",
 *            "skills": [{ "id": "gat_passive_attr_agi", "level": 6 }, …] }
 *        ]
 *      }
 *
 *    逐件记录实物基质，**不再给 weapon_ids**：适配哪些武器由读取方用自己的
 *    数据表算。本站用 `skills` 的三条 gemTermId 去命中 `@/data/weapons` 的
 *    `primaryStat / elementalDamage / specialAbility`。
 *
 * 旧版数组格式（v3.2.0 及更早，文件自带 weapon_ids）不再解析：两代语义不同，
 * 同时维护两套规则只会让判定互相污染。遇到数组只报「请用新版 MaaEND 重新导出」。
 *
 * 语义：CEP 只记录「该武器是否有适配基质」的布尔状态，等级与数量仅用于摘要展示。
 * 因此解析器只关心：哪些武器命中、文件是否盘全（决定能否整体替换标记）。
 *
 * 未知字段与未知枚举值一律忽略（上游 schema 明确要求），只有结构不成立才算损坏。
 */

import { z } from 'zod'
import { weapons } from '@/data/weapons'
import { MAAEND_INVENTORY_FORMAT, MAAEND_PROTOCOL } from './protocol'

const TERM_ID_PATTERN = /^[a-z][a-z0-9_]*$/

/** 基质品质：本站只关心无瑕（高纯等其他品质由规划器单独处理）。 */
const FLAWLESS_GOLD = 'flawless_gold'
/**
 * 明确表示「可用库存」的标记：未标记与已锁定。
 *
 * 其余值（`discard` 以及上游今后可能新增的枚举）一律不计入——schema 允许新增
 * 枚举值，而「未知标记」无法证明这枚基质可用，宁可少算也不要把不可用的算进去。
 */
const USABLE_MARKS: ReadonlySet<string> = new Set(['none', 'lock'])
/**
 * `coverage` 里能证明「无瑕品质已盘全」的键。
 * 后一个是上游按目标缺口口径聚合的键，同样意味着无瑕那一档被完整扫过。
 */
const GOLD_COVERAGE_KEYS = [FLAWLESS_GOLD, 'locked_matching_flawless_gold'] as const

// ─── 本站武器表 → 词条组合索引 ───────────────────────────────

/**
 * 一个词条组合 → 适配它的武器 id（升序）。
 *
 * 只收 4★ 及以上且三条词条齐全的武器：3★ 武器只有两条词条，上游的库存匹配
 * 同样只针对 4/5/6★（`Engine.BuildTargets`），所以这类基质恒为「无对应武器」。
 *
 * 词条顺序不参与匹配：`skills` 按游戏内显示顺序排列，而 termId 本身唯一决定
 * 所属词条池（pool1/2 为 `gat_*`，pool3 为 `gst_*`），因此排序后比较即可。
 */
const WEAPONS_BY_TERM_SET: ReadonlyMap<string, readonly string[]> = buildWeaponTermIndex()

function termSetKey(termIds: readonly string[]): string {
  return [...termIds].sort().join('|')
}

function buildWeaponTermIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const weapon of weapons) {
    if (weapon.rarity < 4) continue
    const terms = [weapon.primaryStat, weapon.elementalDamage, weapon.specialAbility]
    if (terms.some((term) => term === null)) continue
    const key = termSetKey(terms as string[])
    const bucket = index.get(key)
    if (bucket) bucket.push(weapon.id)
    else index.set(key, [weapon.id])
  }
  for (const bucket of index.values()) bucket.sort()
  return index
}

// ─── Schema ──────────────────────────────────────────────────

// 一律用宽松 object（zod 默认丢弃未知键）：上游明确只会新增可选字段与枚举值，
// 严格校验会把「上游加了个字段」误报成文件损坏。
const maaEndTermSchema = z.object({
  id: z.string().regex(TERM_ID_PATTERN),
  // 上限属于游戏数值，schema 不作限制
  level: z.int().min(1),
})

const maaEndItemSchema = z.object({
  quality: z.string().min(1),
  mark: z.string().min(1),
  skills: z.array(maaEndTermSchema).min(1),
})

const maaEndCoverageSchema = z
  .object({
    complete_at: z.string().optional(),
    unread: z.int().min(1).optional(),
  })
  // 上游 schema 用 `not: required[complete_at, unread]` 明确禁止二者共存：
  // 有未读件数就不可能是完整盘点，写方在一轮更新未确认时也会撤下 complete_at。
  // 同时接受会让我们把「有没读到的件」当成盘全了，进而清掉用户已有标记。
  .refine((value) => value.complete_at === undefined || value.unread === undefined, {
    message: 'complete_at 与 unread 不能同时出现',
  })

const maaEndInventorySchema = z.object({
  format: z.literal(MAAEND_INVENTORY_FORMAT),
  version: z.int().min(1),
  // 缺失表示写入时未能确认账号
  account_id: z.string().min(1).optional(),
  updated_at: z.string(),
  coverage: z.record(z.string(), maaEndCoverageSchema),
  items: z.array(maaEndItemSchema),
})

// ─── 结果类型 ────────────────────────────────────────────────

export interface MaaEndEssenceSummary {
  /** 文件自报的协议版本。 */
  protocolVersion: number
  /** 文件写入时间（上游 UTC 时间，原样展示）。 */
  updatedAt: string
  /**
   * true = 文件列全了无瑕品质的每一枚基质，可整体替换该账号的标记。
   * false = 只是已知的一部分（`coverage` 没有 complete_at），此时只能增量叠加。
   */
  complete: boolean
  /** 计入的基质件数（已剔除弃置件与非无瑕品质）。 */
  essenceCount: number
  /** 命中本站武器表的武器 id（升序、去重）。 */
  weaponIds: string[]
  /** 本站武器表里找不到的词条组合（去重，供列表展示）。 */
  unknownItems: string[]
  /** 上述组合对应的基质件数（去重前），用于「跳过 N 件」的计数。 */
  unknownCount: number
}

/** 解析失败的原因，供导入对话框区分文案。 */
export type MaaEndParseFailure =
  /**
   * 结构不成立，或根本不是 MaaEND 基质库存。
   * `issuePath` 是第一条不满足的字段路径（如 `items[3].skills`），
   * 让用户反馈时能直接说出错在哪，而不是只得到「文件可能已损坏」。
   */
  | { reason: 'invalid'; issuePath: string | null }
  /** 文件来自更高的协议版本，本站无法保证语义。 */
  | { reason: 'unsupported_version'; version: number }
  /** 文件是已停止适配的旧版数组格式（v3.2.0 及更早）。 */
  | { reason: 'legacy_unsupported' }

export type MaaEndParseResult =
  | { ok: true; summary: MaaEndEssenceSummary }
  | { ok: false; failure: MaaEndParseFailure }

// ─── 解析 ────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 解析一份 MaaEND 基质库存。
 *
 * 版本先于结构判定：更高的 `version` 即使换了结构也要报「协议过新」，
 * 否则会被当成损坏文件，把上游改版这个真因藏起来。
 */
export function parseMaaEndEssence(value: unknown): MaaEndParseResult {
  // 旧版数组：不猜、不迁移，直接让用户用新版 MaaEND 重新导出
  if (Array.isArray(value)) return { ok: false, failure: { reason: 'legacy_unsupported' } }
  if (isRecord(value) && value.format === MAAEND_INVENTORY_FORMAT) {
    const { version } = value
    if (typeof version === 'number' && Number.isInteger(version) && version > MAAEND_PROTOCOL.version) {
      return { ok: false, failure: { reason: 'unsupported_version', version } }
    }
    return parseCurrentInventory(value)
  }
  return { ok: false, failure: { reason: 'invalid', issuePath: null } }
}

/** Render a zod issue path as `items[3].skills` for the failure message. */
function formatIssuePath(path: readonly PropertyKey[]): string | null {
  let rendered = ''
  for (const segment of path) {
    if (typeof segment === 'number') rendered += `[${segment}]`
    else rendered += rendered ? `.${String(segment)}` : String(segment)
  }
  return rendered || null
}

/** 协议第 1 版及之后的逐件格式。 */
function parseCurrentInventory(value: unknown): MaaEndParseResult {
  const parsed = maaEndInventorySchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      failure: { reason: 'invalid', issuePath: formatIssuePath(parsed.error.issues[0]?.path ?? []) },
    }
  }

  const weaponIds = new Set<string>()
  const unknownItems = new Set<string>()
  let unknownCount = 0
  let essenceCount = 0

  for (const item of parsed.data.items) {
    // 高纯及其他品质、以及任何非「未标记/已锁定」的基质都不参与「该武器有适配基质」
    if (item.quality !== FLAWLESS_GOLD || !USABLE_MARKS.has(item.mark)) continue
    essenceCount += 1

    const termIds = item.skills.map((skill) => skill.id)
    // 只有三条词条的基质才可能对应到武器（2 条的是 3★ 武器专属，本站不追踪）
    const matched = termIds.length === 3 ? WEAPONS_BY_TERM_SET.get(termSetKey(termIds)) : undefined
    if (!matched) {
      unknownCount += 1
      unknownItems.add(termIds.join(' + '))
      continue
    }
    for (const weaponId of matched) weaponIds.add(weaponId)
  }

  return {
    ok: true,
    summary: {
      protocolVersion: parsed.data.version,
      updatedAt: parsed.data.updated_at,
      complete: isGoldCoverageComplete(parsed.data.coverage),
      essenceCount,
      weaponIds: [...weaponIds].sort(),
      unknownItems: [...unknownItems].sort(),
      unknownCount,
    },
  }
}

/** RFC3339/ISO 8601 date-time with an explicit offset, as upstream writes it. */
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/

/**
 * Shape alone is not enough: `2026-02-30` and `T25:05:06` match the pattern but
 * are not real instants. A bogus `complete_at` must not unlock replace mode,
 * because replace mode clears marks the file does not list.
 */
function isValidDateTime(value: string): boolean {
  const match = ISO_DATE_TIME.exec(value)
  if (!match) return false
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match.map(Number)
  if (month < 1 || month > 12) return false
  if (hour > 23 || minute > 59 || second > 59) return false
  // The offset is optional; when present it must be a real UTC offset.
  if (Number.isFinite(offsetHour) && (offsetHour > 23 || offsetMinute > 59)) return false
  // Day-of-month upper bound for that year/month (day 0 of the next month).
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}

/**
 * A tier counts as fully scanned only when `complete_at` is a real timestamp.
 * An empty or malformed value must not be read as "complete", because complete
 * means the import may clear marks absent from the file.
 */
function isGoldCoverageComplete(coverage: Record<string, { complete_at?: string }>): boolean {
  return GOLD_COVERAGE_KEYS.some((quality) => isValidDateTime(coverage[quality]?.complete_at ?? ''))
}
