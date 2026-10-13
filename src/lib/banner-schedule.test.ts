import { describe, expect, it } from 'vitest'
import { buildBannerSchedule, resolvePoolForCharacter } from './banner-schedule'
import type { BannerEntry } from '@/data/banner'
import type { GachaPoolWindow } from '@/types/banner'

// 名字取自真实简中 i18n: chr_0034_typhoea=提弗洛斯, chr_0037_minghe=明河
function entry(overrides: Partial<BannerEntry> = {}): BannerEntry {
  return {
    id: '1.5-tifuluosi',
    title: '「雪凇幽梦」特许寻访',
    description: '',
    imageUrl: '/images/banners/提弗洛斯.webp',
    version: '1.5',
    periodStart: '2026-09-02T12:00:00+08:00',
    periodEnd: '2026-09-30T11:59:00+08:00',
    featured: [{ name: '提弗洛斯' }],
    ...overrides,
  }
}

function pool(overrides: Partial<GachaPoolWindow> = {}): GachaPoolWindow {
  return {
    poolId: 'special_1_5_1',
    kind: 'special',
    upCharacterIds: ['chr_0034_typhoea'],
    start: '2026-09-02T07:00:00+08:00',
    end: '2026-09-30T12:00:00+08:00',
    ...overrides,
  }
}

describe('resolvePoolForCharacter', () => {
  it('matches by UP character and the same opening date', () => {
    expect(resolvePoolForCharacter(entry(), '提弗洛斯', [pool()])?.poolId).toBe('special_1_5_1')
  })

  it('does not match a different date (same character, another rerun window)', () => {
    const other = pool({ poolId: 'rerun_chr_typhoea', start: '2027-01-01T07:00:00+08:00', end: '2027-02-01T12:00:00+08:00' })
    expect(resolvePoolForCharacter(entry(), '提弗洛斯', [other])).toBeUndefined()
  })
})

describe('buildBannerSchedule', () => {
  it('uses upstream times and records the announced-vs-actual difference', () => {
    const { schedule, repairs } = buildBannerSchedule([entry()], [pool()])

    expect(schedule['提弗洛斯'].windows[0]).toMatchObject({
      start: '2026-09-02T07:00:00+08:00',
      end: '2026-09-30T12:00:00+08:00',
      version: '1.5',
    })
    expect(repairs).toEqual([
      { entryId: '1.5-tifuluosi', character: '提弗洛斯', poolId: 'special_1_5_1', field: 'start', handWritten: '2026-09-02T12:00:00+08:00', upstream: '2026-09-02T07:00:00+08:00' },
      { entryId: '1.5-tifuluosi', character: '提弗洛斯', poolId: 'special_1_5_1', field: 'end', handWritten: '2026-09-30T11:59:00+08:00', upstream: '2026-09-30T12:00:00+08:00' },
    ])
  })

  it('keeps the hand-written window for pools the client has not shipped yet', () => {
    const future = entry({ id: '1.6-minghe', periodStart: '2026-11-05T12:00:00+08:00', periodEnd: '2026-11-19T11:59:00+08:00', featured: [{ name: '明河' }] })
    const { schedule, repairs } = buildBannerSchedule([future], [pool()])

    expect(schedule['明河'].windows[0]).toMatchObject({ start: '2026-11-05T12:00:00+08:00', end: '2026-11-19T11:59:00+08:00' })
    expect(repairs).toEqual([])
  })

  it('falls back to the announced end while the client has not fixed it (end: null)', () => {
    const { schedule, repairs } = buildBannerSchedule([entry()], [pool({ end: null })])

    expect(schedule['提弗洛斯'].windows[0].start).toBe('2026-09-02T07:00:00+08:00')
    expect(schedule['提弗洛斯'].windows[0].end).toBe('2026-09-30T11:59:00+08:00')
    expect(repairs.map((repair) => repair.field)).toEqual(['start'])
  })

  it('repairs per character, so unmatched names keep their own window', () => {
    const mixed = entry({ featured: [{ name: '提弗洛斯' }, { name: '明河', isRerun: true }] })
    const { schedule, repairs } = buildBannerSchedule([mixed], [pool()])

    expect(schedule['提弗洛斯'].windows[0].start).toBe('2026-09-02T07:00:00+08:00')
    expect(schedule['明河'].windows[0].start).toBe('2026-09-02T12:00:00+08:00')
    expect(repairs.every((repair) => repair.character === '提弗洛斯')).toBe(true)
  })

  it('marks rerun pools as reruns and merges pending schedule-only windows', () => {
    const rerunPool = pool({ poolId: 'rerun_chr_typhoea', kind: 'rerun', start: '2026-09-02T07:00:00+08:00', end: '2026-09-30T12:00:00+08:00' })
    const { schedule } = buildBannerSchedule([entry({ featured: [{ name: '提弗洛斯' }] })], [rerunPool], {
      '明河': { windows: [{ start: '2026-11-05T12:00:00+08:00', end: '2026-11-19T11:59:00+08:00', version: '1.6', isRerun: false }] },
    })

    expect(schedule['提弗洛斯'].windows[0].isRerun).toBe(true)
    expect(schedule['明河'].windows).toHaveLength(1)
  })

  it('skips hidden entries and sorts each character windows chronologically', () => {
    const hidden = entry({ id: '1.6-minghe', hidden: true, featured: [{ name: '明河' }] })
    const later = pool({ poolId: 'special_1_5_1', start: '2026-09-02T07:00:00+08:00', end: '2026-09-30T12:00:00+08:00' })
    const earlier = pool({ poolId: 'special_1_0_2', start: '2026-02-24T12:00:00+08:00', end: '2026-03-12T12:00:00+08:00' })
    const second = entry({ id: '1.0-yifeng', periodStart: '2026-02-24T12:00:00+08:00', periodEnd: '2026-03-12T12:00:00+08:00', version: '1.0', featured: [{ name: '提弗洛斯' }] })
    const { schedule } = buildBannerSchedule([entry(), second, hidden], [later, earlier])

    expect(schedule['明河']).toBeUndefined()
    expect(schedule['提弗洛斯'].windows.map((window) => window.start)).toEqual(['2026-02-24T12:00:00+08:00', '2026-09-02T07:00:00+08:00'])
  })
})
