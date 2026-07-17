import type { BannerSchedule, BannerWindow } from '@/types/banner'

export interface BannerEntry {
  id: string
  title: string
  subtitle?: string
  description: string
  imageUrl: string
  officialUrl?: string
  version: string
  periodStart: string
  periodEnd: string
  featured: {
    name: string
    period?: number
    isRerun?: boolean
    offRateNote?: string
    versionLabel?: string
  }[]
}

// Future banners without visuals yet — schedule data only
const PENDING_SCHEDULE: Record<string, { windows: BannerWindow[] }> = {
  梨诺: {
    windows: [
      { start: '2026-08-09T12:00:00+08:00', end: '2026-09-02T11:59:00+08:00', version: '1.4', period: 9, isRerun: false },
    ],
  },
}

const STANDARD_CHARS = ['艾尔黛拉', '余烬', '黎风', '别礼', '骏卫'] as const
export const standardCharacters: readonly string[] = STANDARD_CHARS

export const bannerEntries: BannerEntry[] = [
  {
    id: '1.4-jue',
    title: '「临渊望北」特许寻访',
    subtitle: '诀',
    description: '开放时间：「向渊行」版本开启后 - 2026/08/09 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：诀\n\n全部可能出现的6星干员：诀/卡缪/弭弗/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【踞渊北眺寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/jue.webp',
    officialUrl: '',
    version: '1.4',
    periodStart: '2026-07-16T12:00:00+08:00',
    periodEnd: '2026-08-09T11:59:00+08:00',
    featured: [{ name: '诀', period: 9 }],
  },
  {
    id: '1.3-kamiu',
    title: '「逐罪者」特许寻访',
    subtitle: '卡缪',
    description: '开放时间：2026/06/26 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：卡缪\n\n全部可能出现的6星干员：卡缪/弭弗/庄方宜/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【夜趋逐罪寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/kamiu.webp',
    officialUrl: '',
    version: '1.3',
    periodStart: '2026-06-26T12:00:00+08:00',
    periodEnd: '2026-07-16T12:00:00+08:00',
    featured: [{ name: '卡缪', period: 8 }],
  },
  {
    id: '1.3-mifu',
    title: '「拳出无悔」特许寻访',
    subtitle: '弭弗',
    description: '开放时间：「寻遗散记」版本开启后 - 2026/06/26 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：弭弗\n\n全部可能出现的6星干员：弭弗/庄方宜/洛茜/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【拳与心合寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/mifu.webp',
    officialUrl: '',
    version: '1.3',
    periodStart: '2026-06-05T12:00:00+08:00',
    periodEnd: '2026-06-26T11:59:00+08:00',
    featured: [{ name: '弭弗', period: 7 }],
  },
  {
    id: '1.2-huiguangqingdian',
    title: '「辉光庆典」特殊寻访',
    subtitle: '莱万汀 / 洁尔佩塔 / 艾尔黛拉 / 骏卫',
    description: '「辉光庆典」属于「春晓时」版本专属的特殊寻访，为本次特别安排而开放，采用仅适用于本次特殊寻访的专属规则。\n\n开放时间：2026/05/14 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n全部可能出现的6星干员包括：莱万汀/洁尔佩塔/艾尔黛拉/骏卫。\n\n可使用【流光庆时寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 「辉光庆典」不会纳入现有的寻访类型与规则，与其他寻访互不影响。',
    imageUrl: '/images/banners/huiguagnqingdian.webp',
    officialUrl: '',
    version: '1.2',
    periodStart: '2026-05-14T12:00:00+08:00',
    periodEnd: '2026-06-05T12:00:00+08:00',
    featured: [
      { name: '莱万汀', isRerun: true, versionLabel: '1.2「春晓时」' },
      { name: '洁尔佩塔', isRerun: true, versionLabel: '1.2「春晓时」' },
    ],
  },
  {
    id: '1.2-zhuangfangyi',
    title: '「春雷动，万物生」特许寻访',
    subtitle: '庄方宜',
    description: '开放时间：「春晓时」版本开启后 - 2026/05/22 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：庄方宜\n\n全部可能出现的6星干员：庄方宜/洛茜/汤汤/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【春雷醒物寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/zhuangfangyi.webp',
    officialUrl: '',
    version: '1.2',
    periodStart: '2026-04-17T12:00:00+08:00',
    periodEnd: '2026-05-22T11:59:00+08:00',
    featured: [{ name: '庄方宜', period: 6, versionLabel: '1.2「春晓时」新六星' }],
  },
  {
    id: '1.1-luoxi',
    title: '「狼珀」特许寻访',
    subtitle: '洛茜',
    description: '开放时间：2026/03/29 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：洛茜\n\n全部可能出现的6星干员：洛茜/汤汤/伊冯/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【狼群瑰宝寻访凭证】【狼群瑰宝十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/luoxi.webp',
    officialUrl: '',
    version: '1.1',
    periodStart: '2026-03-29T12:00:00+08:00',
    periodEnd: '2026-04-17T12:00:00+08:00',
    featured: [{ name: '洛茜', period: 5, offRateNote: 'bannerCalendar.offRateNote.luoxi', versionLabel: '1.1「新潮起，故渊离」下半' }],
  },
  {
    id: '1.1-tangtang',
    title: '「河流的女儿」特许寻访',
    subtitle: '汤汤',
    description: '开放时间：「新潮起，故渊离」版本开启后 - 2026/03/29 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：汤汤\n\n全部可能出现的6星干员：汤汤/伊冯/洁尔佩塔/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【清波静流寻访凭证】【清波静流十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/tangtang.webp',
    officialUrl: '',
    version: '1.1',
    periodStart: '2026-03-12T12:00:00+08:00',
    periodEnd: '2026-03-29T11:59:00+08:00',
    featured: [{ name: '汤汤', period: 4, offRateNote: 'bannerCalendar.offRateNote.tangtang', versionLabel: '1.1「新潮起，故渊离」上半' }],
  },
  {
    id: '1.0-yifeng',
    title: '「热烈色彩」特许寻访',
    subtitle: '伊冯',
    description: '开放时间：2026/02/24 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：伊冯\n\n全部可能出现的6星干员：伊冯/洁尔佩塔/莱万汀/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【异彩斑斓寻访凭证】【异彩斑斓十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/yifeng.webp',
    officialUrl: '',
    version: '1.0',
    periodStart: '2026-02-24T12:00:00+08:00',
    periodEnd: '2026-03-12T12:00:00+08:00',
    featured: [{ name: '伊冯', period: 3, versionLabel: '1.0「零号委托」下半' }],
  },
  {
    id: '1.0-jieerpeita',
    title: '「轻飘飘的信使」特许寻访',
    subtitle: '洁尔佩塔',
    description: '开放时间：2026/02/07 12:00 - 2026/02/24 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：洁尔佩塔\n\n全部可能出现的6星干员：洁尔佩塔/伊冯/莱万汀/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【灵动信使寻访凭证】【灵动信使十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/jieerpeita.webp',
    officialUrl: '',
    version: '1.0',
    periodStart: '2026-02-07T12:00:00+08:00',
    periodEnd: '2026-02-24T11:59:00+08:00',
    featured: [{ name: '洁尔佩塔', period: 2, versionLabel: '1.0「零号委托」中半' }],
  },
  {
    id: '1.0-laiwanting',
    title: '「熔火灼痕」特许寻访',
    subtitle: '莱万汀',
    description: '开放时间：公测开启后 - 2026/02/07 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：莱万汀\n\n全部可能出现的6星干员：莱万汀/洁尔佩塔/伊冯/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【行火留烬寻访凭证】【行火留烬十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/laiwanting.webp',
    officialUrl: '',
    version: '1.0',
    periodStart: '2026-01-22T12:00:00+08:00',
    periodEnd: '2026-02-07T11:59:00+08:00',
    featured: [{ name: '莱万汀', period: 1, versionLabel: '1.0「零号委托」上半' }],
  },
]

function deriveSchedule(entries: BannerEntry[]): BannerSchedule {
  const schedule: Record<string, { windows: BannerWindow[]; offRateNote?: string }> = {}

  for (const entry of entries) {
    for (const fc of entry.featured) {
      if (!schedule[fc.name]) {
        schedule[fc.name] = { windows: [] }
      }
      schedule[fc.name].windows.push({
        start: entry.periodStart,
        end: entry.periodEnd,
        version: fc.versionLabel ?? entry.version,
        period: fc.period,
        isRerun: fc.isRerun ?? false,
      })
      if (fc.offRateNote) {
        schedule[fc.name].offRateNote = fc.offRateNote
      }
    }
  }

  // Merge pending entries without visuals
  for (const [name, data] of Object.entries(PENDING_SCHEDULE)) {
    if (!schedule[name]) {
      schedule[name] = { windows: [] }
    }
    schedule[name].windows.push(...data.windows)
  }

  return schedule as BannerSchedule
}

export const bannerSchedule: BannerSchedule = deriveSchedule(bannerEntries)
