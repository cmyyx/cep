// Generates the client-side gacha pool table (UP 角色 + 实际时间档) for the
// banner calendar. 数据源全部是客户端表, 不含任何人工推算:
//   - GachaCharPoolTable.json       卡池 -> upCharIds (UP 名单, 多 UP 为数组) + type
//   - GachaCharPoolContentTable.json 池内容; isHardGuaranteeItem 为交叉校验信号
//   - TimeRangeTable.json           time_<poolId> -> timeRangeList (取 entry[0])
// ================================================================================

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import type { GachaPoolData, GachaPoolKind, GachaPoolWindow } from '../../src/types/banner'

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
}

function firstRange(timeRangeTable: GachaPoolSources['timeRangeTable'], key: string): TimeRangeEntry | null {
  const list = timeRangeTable[key]?.timeRangeList
  // entry[0]: 三个候选中与官方口径同行的一条 (entry[1] 与它相同, entry[2] 早一天)
  return Array.isArray(list) && list.length > 0 ? list[0] : null
}

/**
 * 组装卡池数据。纯函数, 便于 fixture 测试; 不触碰文件系统。
 *
 * `issues` 是自检结果 (不阻塞生成): 缺 UP 名单、缺时间档、与池内容表的 UP 标记不一致。
 */
export function buildGachaPoolData(sources: GachaPoolSources): GachaPoolData {
  const { poolTable, contentTable, timeRangeTable } = sources
  const pools: GachaPoolWindow[] = []
  const issues: string[] = []
  const scheduledWithoutPool: GachaPoolData['scheduledWithoutPool'] = []

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

    const range = firstRange(timeRangeTable, `time_${poolId}`)
    const start = parseClientTime(range?.openTime)
    const end = parseClientTime(range?.closeTime)
    if (!range || !start) {
      if (!POOLS_WITHOUT_UP.has(kind)) issues.push(`卡池 ${poolId} (${kind}): 有 UP 名单但没有可用时间档 (TimeRangeTable.time_${poolId})`)
      continue
    }
    pools.push({ poolId, kind, upCharacterIds, start, end })
  }

  const knownPoolIds = new Set(Object.keys(poolTable))
  for (const key of Object.keys(timeRangeTable).sort()) {
    const poolId = key.startsWith('time_') ? key.slice('time_'.length) : ''
    if (!/^(special|joint|rerun)_/.test(poolId) || knownPoolIds.has(poolId)) continue
    const range = firstRange(timeRangeTable, key)
    const start = parseClientTime(range?.openTime)
    if (!start) continue
    // 档期先下发、卡池行后下发 (1.5 的复刻窗口就是这样), 如实记录而不是丢弃。
    scheduledWithoutPool.push({ poolId, start, end: parseClientTime(range?.closeTime) })
  }

  return { pools, scheduledWithoutPool, issues }
}

export interface GachaPoolGenerationResult {
  file: string
  data: GachaPoolData
}

function readTable<T>(akedataPath: string, name: string): T {
  const path = join(akedataPath, 'TableCfg', `${name}.json`)
  if (!existsSync(path)) throw new Error(`generate-gacha-pools: 缺少上游表 ${path}`)
  return parseJsonSafe(path) as T
}

/** 读取上游表并写出 `src/generated/data/gacha-pools.ts`。 */
export function generateGachaPoolData(akedataPath: string, outputDir: string): GachaPoolGenerationResult {
  const data = buildGachaPoolData({
    poolTable: readTable<Record<string, PoolRow>>(akedataPath, 'GachaCharPoolTable'),
    contentTable: readTable<Record<string, ContentRow>>(akedataPath, 'GachaCharPoolContentTable'),
    timeRangeTable: readTable<Record<string, { timeRangeList?: TimeRangeEntry[] }>>(akedataPath, 'TimeRangeTable'),
  })

  mkdirSync(outputDir, { recursive: true })
  const file = join(outputDir, 'gacha-pools.ts')
  const content = `// Auto-generated by scripts/lib/generate-gacha-pools.ts.
// DO NOT EDIT MANUALLY.
import type { GachaPoolData } from '@/types/banner'

export const gachaPoolData: GachaPoolData = ${JSON.stringify(data, null, 2)}

export default gachaPoolData
`
  writeFileSync(file, content, 'utf8')
  return { file, data }
}

/** 供同步流程打印的摘要。 */
export function describeGachaPoolData(data: GachaPoolData): string[] {
  const lines = [`卡池: ${data.pools.length} 个 (含 UP 名单与时间档)`]
  if (data.scheduledWithoutPool.length > 0) {
    lines.push(`  有档期无卡池行: ${data.scheduledWithoutPool.map((entry) => `${entry.poolId}(${entry.start.slice(0, 10)})`).join(', ')}`)
  }
  for (const issue of data.issues) lines.push(`  ⚠ ${issue}`)
  return lines
}
