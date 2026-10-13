import { describe, expect, it } from 'vitest'
import { buildGachaPoolData, parseClientTime, type GachaPoolSources } from './generate-gacha-pools'

/** 精简自真实上游数据 (1.5 期): 特许池单 UP / 联合池双 UP / 复刻池无时间档 / 复刻窗口无卡池行。 */
function sources(): GachaPoolSources {
  return {
    poolTable: {
      special_1_5_1: { id: 'special_1_5_1', type: 0, upCharIds: ['chr_0034_typhoea'] },
      joint_1_2_2: { id: 'joint_1_2_2', type: 3, upCharIds: ['chr_0016_laevat', 'chr_0013_aglina'] },
      rerun_chr_yvonne: { id: 'rerun_chr_yvonne', type: 4, upCharIds: ['chr_0017_yvonne'] },
      standard: { id: 'standard', type: 2, upCharIds: [] },
    },
    contentTable: {
      // 联合池的 isHardGuaranteeItem 全为 false ⇒ 不参与校验
      joint_1_2_2: { list: [{ charId: 'chr_0016_laevat', isHardGuaranteeItem: false }, { charId: 'chr_0013_aglina', isHardGuaranteeItem: false }] },
      special_1_5_1: { list: [{ charId: 'chr_0034_typhoea', isHardGuaranteeItem: true }, { charId: 'chr_0035_liino', isHardGuaranteeItem: false }] },
    },
    timeRangeTable: {
      time_special_1_5_1: { timeRangeList: [{ openTime: '2026/9/2 7:00:00', closeTime: '2026/9/30 12:00:00' }, { openTime: '2026/9/2 7:00:00', closeTime: '2026/9/30 12:00:00' }, { openTime: '2026/9/1 18:00:00', closeTime: '2026/9/30 12:00:00' }] },
      time_joint_1_2_2: { timeRangeList: [{ openTime: '2026/5/14 12:00:00', closeTime: '2026/6/5 6:00:00' }] },
      time_rerun_1_5_2: { timeRangeList: [{ openTime: '2026/9/24 12:00:00', closeTime: '2026/10/15 6:00:00' }] },
    },
  }
}

describe('parseClientTime', () => {
  it('pads the client format into CEP ISO strings (+08:00)', () => {
    expect(parseClientTime('2026/9/2 7:00:00')).toBe('2026-09-02T07:00:00+08:00')
    expect(parseClientTime('2026/10/15 12:00:00')).toBe('2026-10-15T12:00:00+08:00')
  })

  it('returns null for empty or unknown formats', () => {
    expect(parseClientTime('')).toBeNull()
    expect(parseClientTime(undefined)).toBeNull()
    expect(parseClientTime('2026-09-02T07:00:00')).toBeNull()
  })
})

describe('buildGachaPoolData', () => {
  it('takes upCharIds (including multi-UP pools) and entry[0] as the actual window', () => {
    const { pools } = buildGachaPoolData(sources())
    const joint = pools.find((pool) => pool.poolId === 'joint_1_2_2')
    const special = pools.find((pool) => pool.poolId === 'special_1_5_1')

    expect(joint?.upCharacterIds).toEqual(['chr_0016_laevat', 'chr_0013_aglina'])
    expect(joint?.kind).toBe('joint')
    // entry[0] 而不是 entry[2] (早一天那条)
    expect(special?.start).toBe('2026-09-02T07:00:00+08:00')
    expect(special?.end).toBe('2026-09-30T12:00:00+08:00')
  })

  it('keeps pools that have no window yet as an issue instead of dropping them silently', () => {
    const { pools, issues } = buildGachaPoolData(sources())
    const rerun = pools.find((pool) => pool.poolId === 'rerun_chr_yvonne')
    expect(rerun).toBeUndefined()
    expect(issues.some((issue) => issue.includes('rerun_chr_yvonne'))).toBe(true)
  })

  it('reports windows that exist without a pool row (1.5 rerun case)', () => {
    const { scheduledWithoutPool, pools } = buildGachaPoolData(sources())
    expect(pools.map((pool) => pool.poolId)).not.toContain('rerun_1_5_2')
    expect(scheduledWithoutPool).toEqual([{ poolId: 'rerun_1_5_2', start: '2026-09-24T12:00:00+08:00', end: '2026-10-15T06:00:00+08:00' }])
  })

  it('links a rerun pool to the version window named in its own UI asset', () => {
    // 真实上游: rerun_chr_yvonne 有 uiPrefab=GachaPoolNodeRerun_1_5_2, 档期在 time_rerun_1_5_2
    const input = sources()
    input.poolTable.rerun_chr_yvonne = { id: 'rerun_chr_yvonne', type: 4, upCharIds: ['chr_0017_yvonne'], uiPrefab: 'GachaPoolNodeRerun_1_5_2', nameImage: 'gachapool_titleicon_1_5_2' }
    const { pools, scheduledWithoutPool, issues } = buildGachaPoolData(input)
    const rerun = pools.find((pool) => pool.poolId === 'rerun_chr_yvonne')
    expect(rerun).toMatchObject({ kind: 'rerun', timeKey: 'time_rerun_1_5_2', start: '2026-09-24T12:00:00+08:00', end: '2026-10-15T06:00:00+08:00' })
    // 关联走的档期不再算孤儿, 也不再报"缺时间档"
    expect(scheduledWithoutPool).toEqual([])
    expect(issues.some((issue) => issue.includes('rerun_chr_yvonne'))).toBe(false)
  })

  it('refuses to link when more than one family window matches the asset name', () => {
    const input = sources()
    input.poolTable.rerun_chr_yvonne = { id: 'rerun_chr_yvonne', type: 4, upCharIds: ['chr_0017_yvonne'], uiPrefab: 'GachaPoolNodeRerun_1_5_2' }
    // '1_5' 也是 'GachaPoolNodeRerun_1_5_2' 的子串 ⇒ 两个候选 ⇒ 不猜
    input.timeRangeTable.time_rerun_1_5 = { timeRangeList: [{ openTime: '2026/9/1 7:00:00', closeTime: '2026/9/20 12:00:00' }] }
    const { pools, scheduledWithoutPool, issues } = buildGachaPoolData(input)
    expect(pools.find((pool) => pool.poolId === 'rerun_chr_yvonne')).toBeUndefined()
    expect(issues.some((issue) => issue.includes('rerun_chr_yvonne'))).toBe(true)
    expect(scheduledWithoutPool.map((entry) => entry.poolId).sort()).toEqual(['rerun_1_5', 'rerun_1_5_2'])
  })

  it('does not require an UP list on permanent pools', () => {
    const { issues } = buildGachaPoolData(sources())
    expect(issues.some((issue) => issue.includes('standard'))).toBe(false)
  })

  it('flags a mismatch between upCharIds and the pool content table', () => {
    const input = sources()
    input.contentTable.special_1_5_1 = { list: [{ charId: 'chr_0035_liino', isHardGuaranteeItem: true }] }
    const { issues } = buildGachaPoolData(input)
    expect(issues.some((issue) => issue.includes('special_1_5_1') && issue.includes('不一致'))).toBe(true)
  })
})
