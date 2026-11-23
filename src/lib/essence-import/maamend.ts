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
/** 弃置标记：已弃置的基质不算可适配库存。 */
const DISCARD_MARK = 'discard'
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

const maaEndCoverageSchema = z.object({
  complete_at: z.string().optional(),
  unread: z.int().min(1).optional(),
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
  /** 本站武器表里找不到的词条组合，导入时跳过。 */
  unknownItems: string[]
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
  let essenceCount = 0

  for (const item of parsed.data.items) {
    // 高纯及其他品质、已弃置的基质都不参与「该武器有适配基质」
    if (item.quality !== FLAWLESS_GOLD || item.mark === DISCARD_MARK) continue
    essenceCount += 1

    const termIds = item.skills.map((skill) => skill.id)
    // 只有三条词条的基质才可能对应到武器（2 条的是 3★ 武器专属，本站不追踪）
    const matched = termIds.length === 3 ? WEAPONS_BY_TERM_SET.get(termSetKey(termIds)) : undefined
    if (!matched) {
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
    },
  }
}

function isGoldCoverageComplete(coverage: Record<string, { complete_at?: string }>): boolean {
  return GOLD_COVERAGE_KEYS.some((quality) => coverage[quality]?.complete_at !== undefined)
}
