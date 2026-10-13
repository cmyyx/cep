import characterNames from '@/generated/i18n/characters/zh-CN.json'
import type { BannerSchedule, BannerWindow, GachaPoolData, GachaPoolWindow } from '@/types/banner'
import type { BannerEntry } from '@/data/banner'

/**
 * 卡池日历的排期组装。
 *
 * 时间与 UP 名单**以上游客户端数据为准** (`gacha-pool-data.ts` 由
 * scripts/lib/generate-gacha-pools.ts 生成); `banner.ts` 里手写的
 * `periodStart/periodEnd` 只在两种情况下生效:
 *   1. 客户端还没有该卡池 (未下发的未来档期, 如 1.6 的明河/祀)
 *   2. 客户端还没写定结束时间 (`pool.end === null`)
 *
 * 手写值与上游不一致时**不报错, 直接采用上游值**, 差异记进 `repairs` 供追溯
 * (客户端实际开池时间比公告早数小时 —— 维护提前结束即可抽, 属预期差)。
 */

/** 客户端角色 id -> 简中名 (`banner.ts` 的 featured 用手写名字)。 */
const NAME_BY_CHARACTER_ID = characterNames as Record<string, string>

export interface BannerScheduleRepair {
  entryId: string
  character: string
  poolId: string
  field: 'start' | 'end'
  /** banner.ts 里手写的值 (公告口径) */
  handWritten: string
  /** 上游客户端的值 (实际口径) */
  upstream: string
}

/** 公告口径 (12:00/11:59) 与客户端实际口径 (07:00/06:00) 是同一天, 用日期判定同一档期。 */
function sameDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10)
}

function characterNamesForPool(pool: GachaPoolWindow): string[] {
  return pool.upCharacterIds.map((id) => NAME_BY_CHARACTER_ID[id]).filter((name): name is string => typeof name === 'string' && name.length > 0)
}

/**
 * 找出该角色这一档期对应的客户端卡池: UP 名单含该角色, 且开池日期与手写档期一致
 * (复刻/常驻可能多次上榜, 用日期消歧)。
 */
export function resolvePoolForCharacter(
  entry: BannerEntry,
  characterName: string,
  pools: GachaPoolData['pools'],
): GachaPoolWindow | undefined {
  return pools.find((pool) => {
    if (!characterNamesForPool(pool).includes(characterName)) return false
    if (!sameDay(pool.start, entry.periodStart)) return false
    // pool.end 为 null = 客户端还没写定结束时间, 此时不参与日期消歧
    return pool.end === null || sameDay(pool.end, entry.periodEnd)
  })
}

export interface DerivedBannerSchedule {
  schedule: BannerSchedule
  repairs: BannerScheduleRepair[]
}

/**
 * 卡面展示用的档期: 与该条目在时间轴上的窗口一致 (上游优先)。
 * 客户端尚未下发该卡池时回退手写公告值。
 */
export function resolveEntryWindow(entry: BannerEntry, pools: GachaPoolData['pools']): { start: string; end: string } {
  const matched = entry.featured
    .map((featured) => resolvePoolForCharacter(entry, featured.name, pools))
    .filter((pool): pool is GachaPoolWindow => pool !== undefined)
  if (matched.length === 0) return { start: entry.periodStart, end: entry.periodEnd }

  const starts = matched.map((pool) => pool.start).sort()
  // 结束时间未写定的池子回退到公告口径
  const ends = matched.map((pool) => pool.end ?? entry.periodEnd).sort()
  return { start: starts[0], end: ends[ends.length - 1] }
}

/**
 * 组装每角色的 UP 窗口。上游优先, 手写兜底; 差异写入 `repairs`。
 */
export function buildBannerSchedule(
  entries: BannerEntry[],
  pools: GachaPoolData['pools'],
  pending: Record<string, { windows: BannerWindow[] }> = {},
): DerivedBannerSchedule {
  const schedule: BannerSchedule = {}
  const repairs: BannerScheduleRepair[] = []

  for (const entry of entries) {
    if (entry.hidden) continue
    for (const featured of entry.featured) {
      const pool = resolvePoolForCharacter(entry, featured.name, pools)
      // 上游还没写定结束时回退到公告口径, 其余一律以上游为准
      const start = pool?.start ?? entry.periodStart
      const end = pool?.end ?? entry.periodEnd
      if (pool) {
        if (pool.start !== entry.periodStart) {
          repairs.push({ entryId: entry.id, character: featured.name, poolId: pool.poolId, field: 'start', handWritten: entry.periodStart, upstream: pool.start })
        }
        if (pool.end !== null && pool.end !== entry.periodEnd) {
          repairs.push({ entryId: entry.id, character: featured.name, poolId: pool.poolId, field: 'end', handWritten: entry.periodEnd, upstream: pool.end })
        }
      }

      const bucket = schedule[featured.name] ?? { windows: [] }
      bucket.windows.push({
        start,
        end,
        version: featured.versionLabel ?? entry.version,
        period: featured.period,
        isRerun: featured.isRerun ?? pool?.kind === 'rerun',
      })
      if (featured.offRateNote) bucket.offRateNote = featured.offRateNote
      schedule[featured.name] = bucket
    }
  }

  // 只有档期、还没有立绘/文案的未来卡池
  for (const [name, data] of Object.entries(pending)) {
    const bucket = schedule[name] ?? { windows: [] }
    bucket.windows.push(...data.windows)
    schedule[name] = bucket
  }

  for (const bucket of Object.values(schedule)) {
    bucket.windows.sort((left, right) => {
      if (left.start === right.start) {
        const leftPeriod = typeof left.period === 'number' ? left.period : 0
        const rightPeriod = typeof right.period === 'number' ? right.period : 0
        return leftPeriod - rightPeriod
      }
      return left.start.localeCompare(right.start)
    })
  }

  return { schedule, repairs }
}
