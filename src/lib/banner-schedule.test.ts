import { describe, expect, it } from 'vitest'
import { buildBannerSchedule } from './banner-schedule'
import type { BannerEntry } from '@/data/banner'

function entry(overrides: Partial<BannerEntry> & Pick<BannerEntry, 'id'>): BannerEntry {
  return {
    title: '「冬猎」特许寻访',
    description: '',
    imageUrl: '/images/banners/x.webp',
    version: '1.5',
    periodStart: '2026-09-02T07:00:00+08:00',
    periodEnd: '2026-09-30T12:00:00+08:00',
    featured: [{ name: '提弗洛斯', period: 14 }],
    ...overrides,
  }
}

describe('buildBannerSchedule', () => {
  it('groups windows per featured character with the entry times', () => {
    const schedule = buildBannerSchedule([entry({ id: '1.5-tifuluosi' })])
    expect(schedule['提弗洛斯'].windows).toEqual([
      { start: '2026-09-02T07:00:00+08:00', end: '2026-09-30T12:00:00+08:00', version: '1.5', period: 14, isRerun: false },
    ])
  })

  it('skips hidden placeholder entries', () => {
    const schedule = buildBannerSchedule([
      entry({ id: '1.6-minghe', hidden: true, featured: [{ name: '明河', period: 14 }] }),
    ])
    expect(schedule['明河']).toBeUndefined()
  })

  it('carries the rerun flag and per-featured version label / off-rate note', () => {
    const schedule = buildBannerSchedule([
      entry({
        id: '1.5-yifeng',
        periodStart: '2026-09-24T12:00:00+08:00',
        featured: [{ name: '伊冯', isRerun: true, versionLabel: '1.5 下半', offRateNote: '50%' }],
      }),
    ])
    expect(schedule['伊冯']).toEqual({
      windows: [{ start: '2026-09-24T12:00:00+08:00', end: '2026-09-30T12:00:00+08:00', version: '1.5 下半', period: undefined, isRerun: true }],
      offRateNote: '50%',
    })
  })

  it('merges future windows that have no banner art yet and sorts by start', () => {
    const schedule = buildBannerSchedule(
      [entry({ id: '1.5-yifeng', periodStart: '2026-09-24T12:00:00+08:00', featured: [{ name: '伊冯', isRerun: true }] })],
      { 伊冯: { windows: [{ start: '2026-02-24T12:00:00+08:00', end: '2026-03-12T06:00:00+08:00', version: '1.0', period: 3, isRerun: false }] } },
    )
    expect(schedule['伊冯'].windows.map((window) => window.start)).toEqual([
      '2026-02-24T12:00:00+08:00',
      '2026-09-24T12:00:00+08:00',
    ])
  })

  it('sorts same-start windows by period so the main UP comes first', () => {
    const schedule = buildBannerSchedule([
      entry({ id: 'a', periodStart: '2026-01-01T12:00:00+08:00', featured: [{ name: '甲', period: 21 }] }),
      entry({ id: 'b', periodStart: '2026-01-01T12:00:00+08:00', featured: [{ name: '甲', period: 14 }] }),
    ])
    expect(schedule['甲'].windows.map((window) => window.period)).toEqual([14, 21])
  })
})
