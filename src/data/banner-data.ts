import type { BannerSchedule } from '@/types/banner'

/**
 * Banner UP schedule data with period tracking.
 * Key: character name (Chinese)
 *
 * period: 卡池期数 (1-based, from earliest to latest)
 * isRerun: true = 辉光庆典复刻池, false = 特许寻访主UP池
 */
export const bannerSchedule: BannerSchedule = {
  莱万汀: {
    windows: [
      { start: '2026-01-22T12:00:00+08:00', end: '2026-02-07T12:00:00+08:00', version: '1.0「零号委托」上半', period: 1, isRerun: false },
      { start: '2026-05-14T12:00:00+08:00', end: '2026-06-05T12:00:00+08:00', version: '1.2「春晓时」', isRerun: true },
    ],
  },
  洁尔佩塔: {
    windows: [
      { start: '2026-02-07T12:00:00+08:00', end: '2026-02-24T12:00:00+08:00', version: '1.0「零号委托」中半', period: 2, isRerun: false },
      { start: '2026-05-14T12:00:00+08:00', end: '2026-06-05T12:00:00+08:00', version: '1.2「春晓时」', isRerun: true },
    ],
  },
  伊冯: {
    windows: [
      { start: '2026-02-24T12:00:00+08:00', end: '2026-03-12T12:00:00+08:00', version: '1.0「零号委托」下半', period: 3, isRerun: false },
    ],
  },
  汤汤: {
    windows: [
      { start: '2026-03-12T12:00:00+08:00', end: '2026-03-29T12:00:00+08:00', version: '1.1「新潮起，故渊离」上半', period: 4, isRerun: false },
    ],
    offRateNote: '只可在庄方宜的「春雷动」特许寻访里歪到',
  },
  洛茜: {
    windows: [
      { start: '2026-03-29T12:00:00+08:00', end: '2026-04-17T12:00:00+08:00', version: '1.1「新潮起，故渊离」下半', period: 5, isRerun: false },
    ],
    offRateNote: '只可在庄方宜的「春雷动」特许寻访里歪到',
  },
  庄方宜: {
    windows: [
      { start: '2026-04-17T12:00:00+08:00', end: '2026-05-22T12:00:00+08:00', version: '1.2「春晓时」新六星', period: 6, isRerun: false },
    ],
  },
}

/** Standard (permanent pool) 6-star characters — always available, never OUT */
export const standardCharacters: string[] = ['艾尔黛拉', '余烬', '黎风', '别礼', '骏卫']
