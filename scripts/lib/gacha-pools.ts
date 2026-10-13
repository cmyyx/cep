// 读取客户端卡池表 (UP 角色 + 实际时间档 + 池名), 供 `update-banner-file.ts` 直接更新
// `src/data/banner.ts` —— 不产出独立数据文件 (卡池日历只有一个数据来源: banner.ts)。
// 数据源全部是客户端表, 不含任何人工推算:
//   - GachaCharPoolTable.json       卡池 -> upCharIds (UP 名单, 多 UP 为数组) + type
//   - GachaCharPoolContentTable.json 池内容; isHardGuaranteeItem 为交叉校验信号
//   - TimeRangeTable.json           time_<poolId> -> timeRangeList (取 entry[0])
// ================================================================================

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import { loadAllTextTables } from './stat-mapping'

/** 池型 (`GachaCharPoolTable.type`) 的语义。与池 id 前缀互相印证 (special_* / joint_* / rerun_*)。 */
export type GachaPoolKind = 'special' | 'beginner' | 'standard' | 'joint' | 'rerun'

/** 单个卡池 (含实际时间档)。 */
export interface GachaPool {
  poolId: string
  kind: GachaPoolKind
  /** 上游池名 (简中), 取自 `GachaCharPoolTable.name.id` → I18nTextTable_CN */
  title: string
  /** 概率提升角色, 多 UP 为多个 */
  upCharacterIds: string[]
  /** 客户端实际开池时刻: 维护提前结束即可抽, 早于公告口径的 12:00 */
  start: string
  /** 结束时间尚未写定时为 null (客户端 closeTime 为空) */
  end: string | null
  /** 实际使用的 TimeRangeTable 键 (复刻池的档期挂在 time_rerun_<版本> 上) */
  timeKey: string
}

export interface GachaPoolData {
  pools: GachaPool[]
  /** 有档期但客户端还没有卡池行的窗口 (如实记录, 不猜 UP) */
  scheduledWithoutPool: Array<{ poolId: string; start: string; end: string | null }>
  /** 自检结果: 缺 UP 名单 / 缺时间档 / 与池内容表不一致 */
  issues: string[]
}

/** `GachaCharPoolTable.type` -> 语义。与池 id 前缀互相印证 (special_* / joint_* / rerun_*)。 */
const KIND_BY_TYPE: Record<number, GachaPoolKind> = {
  0: 'special',
  1: 'beginner',
  2: 'standard',
  3: 'joint',
  4: 'rerun',
}

/** 常驻池没有 UP 名单, 也不该报"缺 UP"。 */
const POOLS_WITHOUT_UP: ReadonlySet<GachaPoolKind> = new Set<GachaPoolKind>(['beginner', 'standard'])

/**
 * 客户端时间字符串 -> CEP 的 ISO 口径。
 *
 * 客户端写 `2026/9/2 7:00:00` (无前导零), 与 CEP 现有手写数据同为 +08:00 日历;
 * 它比公告的 12:00 早几小时, 因为维护通常提前结束、池子随维护结束即可抽。
 */
export function parseClientTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const pad = (part: string, size = 2) => part.padStart(size, '0')
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`
}

interface TimeRangeEntry {
  openTime?: unknown
  closeTime?: unknown
}

interface PoolRow {
  id?: unknown
  type?: unknown
  upCharIds?: unknown
  /** 池名文本 id (`parseJsonSafe` 无损 -> 字符串) */
  name?: { id?: unknown }
  /** 池行的 UI 资源名: 复刻池的版本号只写在这里 (如 GachaPoolNodeRerun_1_5_2) */
  uiPrefab?: unknown
  nameImage?: unknown
  tabImage?: unknown
}

interface ContentRow {
  list?: Array<{ charId?: unknown; isHardGuaranteeItem?: unknown }>
}

export interface GachaPoolSources {
  /** GachaCharPoolTable.json */
  poolTable: Record<string, PoolRow>
  /** GachaCharPoolContentTable.json */
  contentTable: Record<string, ContentRow>
  /** TimeRangeTable.json */
  timeRangeTable: Record<string, { timeRangeList?: TimeRangeEntry[] }>
  /** I18nTextTable_*.json (只用到简中): 池名 name.id -> 文本 */
  textTables: Record<string, Record<string, string>>
}

/** 池名: `name.id` (字符串, 无损) → 简中文本; 取不到就返回空串 (不猜) */
function poolTitle(textTables: GachaPoolSources['textTables'], row: PoolRow): string {
  const id = row.name?.id === undefined ? '' : String(row.name.id)
  if (!id) return ''
  return textTables['zh-CN']?.[id] ?? ''
}

/** 池型 -> `TimeRangeTable` 键的家族前缀 (复刻/联合/特许都是 `time_<家族>_<版本>`) */
const TIME_FAMILY_BY_KIND: Partial<Record<GachaPoolKind, string>> = {
  special: 'special',
  joint: 'joint',
  rerun: 'rerun',
}

function firstRange(timeRangeTable: GachaPoolSources['timeRangeTable'], key: string): TimeRangeEntry | null {
  const list = timeRangeTable[key]?.timeRangeList
  // entry[0]: 三个候选中与官方口径同行的一条 (entry[1] 与它相同, entry[2] 早一天)
  return Array.isArray(list) && list.length > 0 ? list[0] : null
}

/**
 * 卡池行没有自己的 `time_<poolId>` 时, 找该家族里**唯一**能挂上的时间档。
 *
 * 复刻池就是这样: `rerun_chr_yvonne` 的档期写在 `time_rerun_1_5_2` 下, 版本号 `1_5_2` 只
 * 出现在池行自己的 UI 资源名 (`uiPrefab`/`nameImage`/`tabImage`) 里。因此用一个硬条件 + 一个
 * 软条件收敛: (1) 该键属于同家族且还没被其他卡池行占用; (2) 池行的资源名里含该键的版本号。
 * 命中数必须**恰好为 1**, 否则返回 null 让调用方照旧报 issue —— 不猜、不取第一个。
 */
export function resolveLinkedTimeKey(
  row: PoolRow,
  poolId: string,
  kind: GachaPoolKind,
  timeRangeTable: GachaPoolSources['timeRangeTable'],
  knownPoolIds: ReadonlySet<string>,
): string | null {
  const family = TIME_FAMILY_BY_KIND[kind]
  if (!family) return null
  const artNames = [row.uiPrefab, row.nameImage, row.tabImage].filter((value): value is string => typeof value === 'string' && value.length > 0)
  if (artNames.length === 0) return null
  const candidates = Object.keys(timeRangeTable)
    .filter((key) => {
      const rest = key.startsWith(`time_${family}_`) ? key.slice('time_'.length) : ''
      if (!rest) return false
      // 已被别的卡池行按 id 直接认领的档期不能抢
      if (knownPoolIds.has(rest)) return false
      if (rest === poolId) return false
      const version = rest.slice(`${family}_`.length)
      if (version.length === 0) return false
      return artNames.some((name) => name.includes(version))
    })
    .sort()
  return candidates.length === 1 ? candidates[0] : null
}

/**
 * 组装卡池数据。纯函数, 便于 fixture 测试; 不触碰文件系统。
 *
 * `issues` 是自检结果 (不阻塞生成): 缺 UP 名单、缺时间档、与池内容表的 UP 标记不一致。
 */
export function buildGachaPoolData(sources: GachaPoolSources): GachaPoolData {
  const { poolTable, contentTable, timeRangeTable, textTables } = sources
  const pools: GachaPool[] = []
  const issues: string[] = []
  const scheduledWithoutPool: GachaPoolData['scheduledWithoutPool'] = []
  const knownPoolIds = new Set(Object.keys(poolTable))
  /** 已被卡池行用掉的时间档 (含 UI 资源名关联的), 孤儿扫描要跳过 */
  const claimedTimeKeys = new Set<string>()

  for (const poolId of Object.keys(poolTable).sort()) {
    const row = poolTable[poolId]
    const kind = KIND_BY_TYPE[Number(row.type)]
    if (!kind) {
      issues.push(`卡池 ${poolId}: 未知 type=${String(row.type)}`)
      continue
    }
    const upCharacterIds = Array.isArray(row.upCharIds) ? row.upCharIds.filter((id): id is string => typeof id === 'string') : []
    if (upCharacterIds.length === 0 && !POOLS_WITHOUT_UP.has(kind)) {
      issues.push(`卡池 ${poolId} (${kind}): 客户端没有给出 UP 名单 (upCharIds 为空)`)
    }

    // 池内容表的 isHardGuaranteeItem 只在部分池型上打标 (联合池全为 false), 只做交叉校验。
    const contentUp = (contentTable[poolId]?.list ?? []).filter((entry) => entry.isHardGuaranteeItem === true).map((entry) => String(entry.charId))
    if (contentUp.length > 0) {
      const missing = upCharacterIds.filter((id) => !contentUp.includes(id))
      const extra = contentUp.filter((id) => !upCharacterIds.includes(id))
      if (missing.length > 0 || extra.length > 0) {
        issues.push(`卡池 ${poolId}: UP 名单与池内容表不一致 (upCharIds=[${upCharacterIds.join(',')}] / isHardGuaranteeItem=[${contentUp.join(',')}])`)
      }
    }

    const ownKey = `time_${poolId}`
    const linkedKey = firstRange(timeRangeTable, ownKey) ? null : resolveLinkedTimeKey(row, poolId, kind, timeRangeTable, knownPoolIds)
    const timeKey = linkedKey ?? ownKey
    const range = firstRange(timeRangeTable, timeKey)
    const start = parseClientTime(range?.openTime)
    const end = parseClientTime(range?.closeTime)
    if (!range || !start) {
      if (!POOLS_WITHOUT_UP.has(kind)) issues.push(`卡池 ${poolId} (${kind}): 有 UP 名单但没有可用时间档 (TimeRangeTable.time_${poolId})`)
      continue
    }
    claimedTimeKeys.add(timeKey)
    pools.push({ poolId, kind, title: poolTitle(textTables, row), upCharacterIds, start, end, timeKey })
  }

  for (const key of Object.keys(timeRangeTable).sort()) {
    const poolId = key.startsWith('time_') ? key.slice('time_'.length) : ''
    if (!/^(special|joint|rerun)_/.test(poolId) || knownPoolIds.has(poolId)) continue
    if (claimedTimeKeys.has(key)) continue
    const range = firstRange(timeRangeTable, key)
    const start = parseClientTime(range?.openTime)
    if (!start) continue
    // 档期先下发、卡池行后下发 (1.5 的复刻窗口就是这样), 如实记录而不是丢弃。
    scheduledWithoutPool.push({ poolId, start, end: parseClientTime(range?.closeTime) })
  }

  return { pools, scheduledWithoutPool, issues }
}

function readTable<T>(akedataPath: string, name: string): T {
  const path = join(akedataPath, 'TableCfg', `${name}.json`)
  if (!existsSync(path)) throw new Error(`gacha-pools: 缺少上游表 ${path}`)
  return parseJsonSafe(path) as T
}

/**
 * 读取上游表并组装卡池数据 (纯返回, 不写文件 —— 卡池日历的数据落点是 `src/data/banner.ts`)。
 */
export function loadGachaPoolData(akedataPath: string): GachaPoolData {
  return buildGachaPoolData({
    poolTable: readTable<Record<string, PoolRow>>(akedataPath, 'GachaCharPoolTable'),
    contentTable: readTable<Record<string, ContentRow>>(akedataPath, 'GachaCharPoolContentTable'),
    timeRangeTable: readTable<Record<string, { timeRangeList?: TimeRangeEntry[] }>>(akedataPath, 'TimeRangeTable'),
    textTables: loadAllTextTables(akedataPath),
  })
}

/** 供同步流程打印的摘要。 */
export function describeGachaPoolData(data: GachaPoolData): string[] {
  const lines = [`卡池: ${data.pools.length} 个 (含 UP 名单与时间档)`]
  if (data.scheduledWithoutPool.length > 0) {
    lines.push(`  有档期无卡池行: ${data.scheduledWithoutPool.map((entry) => `${entry.poolId}(${entry.start.slice(0, 10)})`).join(', ')}`)
  }
  for (const pool of data.pools) {
    if (pool.timeKey !== `time_${pool.poolId}`) lines.push(`  ${pool.poolId}: 时间档取自 ${pool.timeKey} (UI 资源名关联)`)
  }
  for (const issue of data.issues) lines.push(`  ⚠ ${issue}`)
  return lines
}
