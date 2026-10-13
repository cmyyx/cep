import type { BannerSchedule, BannerWindow } from '@/types/banner'
import type { BannerEntry } from '@/data/banner'

/**
 * 卡池日历的排期组装 (只读 `src/data/banner.ts`)。
 *
 * 时间、UP 名单、复刻标记在**同步时**已由 `scripts/lib/update-banner-file.ts` 按客户端数据
 * 直接写进 `banner.ts` —— 卡池数据只有一个落点, 运行时不再合并第二份文件。
 * 这里只负责: 按角色归集窗口 + 排序 + 合并"还没有卡面"的未来档期。
 */
export function buildBannerSchedule(
  entries: BannerEntry[],
  pending: Record<string, { windows: BannerWindow[] }> = {},
): BannerSchedule {
  const schedule: BannerSchedule = {}

  for (const entry of entries) {
    if (entry.hidden) continue
    for (const featured of entry.featured) {
      const bucket = schedule[featured.name] ?? { windows: [] }
      bucket.windows.push({
        start: entry.periodStart,
        end: entry.periodEnd,
        version: featured.versionLabel ?? entry.version,
        period: featured.period,
        isRerun: featured.isRerun ?? false,
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

  return schedule
}
