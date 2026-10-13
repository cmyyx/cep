import { describe, expect, it } from 'vitest'
import { updateBannerEntries } from './update-banner-file'
import type { GachaPool } from './gacha-pools'

const NAMES = { chr_0034_typhoea: '提弗洛斯', chr_0017_yvonne: '伊冯', chr_0016_laevat: '莱万汀', chr_0013_aglina: '洁尔佩塔', chr_0025_minghe: '明河' }

/** 精简自真实 `src/data/banner.ts`。 */
const BANNER_TS = `export const bannerEntries: BannerEntry[] = [
  {
    id: '1.5-tifuluosi',
    title: '「冬猎」特许寻访',
    subtitle: '提弗洛斯',
    version: '1.5',
    periodStart: '2026-09-02T12:00:00+08:00',
    periodEnd: '2026-09-30T11:59:00+08:00',
    featured: [{ name: '提弗洛斯', period: 14 }],
  },
  {
    id: '1.5-yifeng',
    title: '「绚丽异彩」重构寻访',
    subtitle: '伊冯',
    version: '1.5',
    periodStart: '2026-09-24T12:00:00+08:00',
    periodEnd: '2026-10-15T11:59:00+08:00',
    featured: [{ name: '伊冯', isRerun: true }],
  },
  {
    id: '1.6-minghe',
    title: '「烟火邀星河」特许寻访',
    subtitle: '明河',
    version: '1.6',
    periodStart: '2026-11-05T12:00:00+08:00',
    periodEnd: '2099-12-31T11:59:00+08:00',
    hidden: true,
    featured: [{ name: '明河', period: 14 }],
  },
]
`

function pool(overrides: Partial<GachaPool> = {}): GachaPool {
  return {
    poolId: 'special_1_5_1',
    kind: 'special',
    title: '冬猎',
    upCharacterIds: ['chr_0034_typhoea'],
    start: '2026-09-02T07:00:00+08:00',
    end: '2026-09-30T12:00:00+08:00',
    timeKey: 'time_special_1_5_1',
    ...overrides,
  }
}

describe('updateBannerEntries', () => {
  it('writes the client start/end into the matching entry and records the change', () => {
    const result = updateBannerEntries(BANNER_TS, [pool()], NAMES)
    expect(result.updated).toEqual([
      {
        entryId: '1.5-tifuluosi',
        poolId: 'special_1_5_1',
        changes: [
          'periodStart 2026-09-02T12:00:00+08:00 -> 2026-09-02T07:00:00+08:00',
          'periodEnd 2026-09-30T11:59:00+08:00 -> 2026-09-30T12:00:00+08:00',
          'poolId: special_1_5_1',
        ],
      },
    ])
    expect(result.content).toContain("poolId: 'special_1_5_1',")
    expect(result.content).toContain("periodStart: '2026-09-02T07:00:00+08:00',")
    expect(result.content).toContain("periodEnd: '2026-09-30T12:00:00+08:00',")
    // 其他条目原样
    expect(result.content).toContain("periodStart: '2026-09-24T12:00:00+08:00',")
    expect(result.content).toContain("periodStart: '2026-11-05T12:00:00+08:00',")
  })

  it('is idempotent once poolId is recorded', () => {
    const first = updateBannerEntries(BANNER_TS, [pool()], NAMES)
    expect(first.updated[0].changes).toContain('poolId: special_1_5_1')
    // 第二次: 已按 poolId 关联且时间已是上游值 -> 无任何改动
    const second = updateBannerEntries(first.content, [pool()], NAMES)
    expect(second.updated).toEqual([])
    expect(second.content).toBe(first.content)
    const third = updateBannerEntries(second.content, [pool()], NAMES)
    expect(third.content).toBe(second.content)
  })

  it('adds isRerun for upstream rerun pools without touching hand-written rerun entries', () => {
    const rerun = pool({ poolId: 'rerun_chr_yvonne', kind: 'rerun', title: '绚丽异彩', upCharacterIds: ['chr_0017_yvonne'], start: '2026-09-24T12:00:00+08:00', end: '2026-10-15T06:00:00+08:00', timeKey: 'time_rerun_1_5_2' })
    const result = updateBannerEntries(BANNER_TS, [rerun], NAMES)
    // 手写条目已有 isRerun: true, 不重复插入
    expect(result.content.match(/isRerun: true/g)).toHaveLength(1)
    expect(result.updated[0].changes.some((change) => change.includes('isRerun'))).toBe(false)

    const withoutFlag = BANNER_TS.replace(', isRerun: true', '')
    const added = updateBannerEntries(withoutFlag, [rerun], NAMES)
    expect(added.content).toContain("{ name: '伊冯', isRerun: true }")
    expect(added.updated[0].changes).toContain('isRerun: true (上游复刻池)')
  })

  it('keeps hand-written values for entries the client has not published, and lists them', () => {
    const result = updateBannerEntries(BANNER_TS, [pool()], NAMES)
    // 1.5-tifuluosi 已匹配上游, 只剩 yifeng 还没下发
    expect(result.pending).toEqual(['1.5-yifeng (「绚丽异彩」重构寻访)'])
  })

  it('reports upstream pools without an entry, and hand-written content that disagrees', () => {
    const unknown = pool({ poolId: 'special_9_9_9', title: '不存在的池', upCharacterIds: ['chr_9999_x'], start: '2026-12-01T07:00:00+08:00' })
    const renamed = pool({ title: '别的池名' })
    const missingUp = pool({ upCharacterIds: ['chr_0034_typhoea', 'chr_0013_aglina'] })
    const result = updateBannerEntries(BANNER_TS, [unknown, renamed, missingUp], NAMES)
    expect(result.issues.some((issue) => issue.includes('没有唯一对应条目') && issue.includes('special_9_9_9'))).toBe(true)
    expect(result.issues.some((issue) => issue.includes('不含上游池名'))).toBe(true)
    expect(result.issues.some((issue) => issue.includes('featured 缺少上游 UP 角色 (洁尔佩塔)'))).toBe(true)
  })

  it('handles CRLF files without rewriting line endings', () => {
    const crlf = BANNER_TS.replace(/\n/g, '\r\n')
    const result = updateBannerEntries(crlf, [pool()], NAMES)
    expect(result.updated).toHaveLength(1)
    expect(result.content).toContain("periodStart: '2026-09-02T07:00:00+08:00',\r\n")
    expect(result.content.split('\r\n')).toHaveLength(crlf.split('\r\n').length + 1)
  })

  it('fills and un-hides a placeholder entry once the client publishes the pool', () => {
    const published = pool({ poolId: 'special_1_6_1', title: '烟火邀星河', upCharacterIds: ['chr_0025_minghe'], start: '2026-11-05T07:00:00+08:00', end: '2026-11-19T12:00:00+08:00', timeKey: 'time_special_1_6_1' })
    const result = updateBannerEntries(BANNER_TS, [published], NAMES)
    expect(result.updated[0].entryId).toBe('1.6-minghe')
    expect(result.updated[0].changes).toContain('hidden 去掉 (上游已下发该卡池)')
    expect(result.content).toContain("periodStart: '2026-11-05T07:00:00+08:00',")
    expect(result.content).not.toContain('hidden: true')
    expect(result.pending).toEqual(['1.5-tifuluosi (「冬猎」特许寻访)', '1.5-yifeng (「绚丽异彩」重构寻访)'])
  })
})
