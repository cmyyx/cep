import { buildBannerSchedule } from '@/lib/banner-schedule'
import type { BannerSchedule, BannerWindow } from '@/types/banner'

export interface BannerEntry {
  id: string
  /**
   * 对应的客户端卡池 id (`special_1_5_1` / `rerun_chr_yvonne` ...), 由同步写入。
   * 同期数据在下次同步时按它精确关联, 不再靠"角色名 + 开池日期"猜。
   */
  poolId?: string
  title: string
  subtitle?: string
  description: string
  imageUrl: string
  officialUrl?: string
  version: string
  periodStart: string
  periodEnd: string
  /**
   * 占位条目：日期待官方公布，暂不解析展示。
   * 设为 true 后 deriveSchedule 与卡池图条都会跳过该条目。
   */
  hidden?: boolean
  featured: {
    name: string
    period?: number
    isRerun?: boolean
    offRateNote?: string
    versionLabel?: string
  }[]
}

// Future banners without visuals yet — schedule data only
const PENDING_SCHEDULE: Record<string, { windows: BannerWindow[] }> = {}

const STANDARD_CHARS = ['艾尔黛拉', '余烬', '黎风', '别礼', '骏卫'] as const
export const standardCharacters: readonly string[] = STANDARD_CHARS

export const bannerEntries: BannerEntry[] = [
  {
    id: '1.6-minghe',
    title: '「烟火邀星河」特许寻访',
    subtitle: '明河',
    description: '',
    imageUrl: '/images/banners/明河.webp',
    officialUrl: '',
    version: '1.6',
    periodStart: '2026-11-05T12:00:00+08:00',
    // TODO: 结束时间待官方公布，当前为占位值；公布后填入真实时间并去掉 hidden
    periodEnd: '2099-12-31T11:59:00+08:00',
    hidden: true,
    featured: [{ name: '明河', period: 14 }],
  },
  {
    id: '1.6-tangtang',
    title: '「祖泉的新流」重构寻访',
    subtitle: '汤汤',
    description: '',
    imageUrl: '/images/banners/汤汤重构寻访.webp',
    officialUrl: '',
    version: '1.6',
    periodStart: '2026-10-29T12:00:00+08:00',
    periodEnd: '2026-11-19T11:59:00+08:00',
    featured: [{ name: '汤汤', isRerun: true }],
  },
  {
    id: '1.6-si',
    title: '「万物更新」特许寻访',
    subtitle: '祀',
    description: '',
    imageUrl: '/images/banners/祀.webp',
    officialUrl: '',
    version: '1.6',
    periodStart: '2026-10-15T12:00:00+08:00',
    periodEnd: '2026-11-05T11:59:00+08:00',
    featured: [{ name: '祀', period: 13 }],
  },
  {
    id: '1.5-yifeng',
    poolId: 'rerun_chr_yvonne',
    title: '「绚丽异彩」重构寻访',
    subtitle: '伊冯',
    description: '',
    imageUrl: '/images/banners/伊冯重构寻访.webp',
    officialUrl: '',
    version: '1.5',
    periodStart: '2026-09-24T12:00:00+08:00',
    periodEnd: '2026-10-15T06:00:00+08:00',
    featured: [{ name: '伊冯', isRerun: true }],
  },
  {
    id: '1.5-tifuluosi',
    poolId: 'special_1_5_1',
    title: '「冬猎」特许寻访',
    subtitle: '提弗洛斯',
    description: '',
    imageUrl: '/images/banners/提弗洛斯.webp',
    officialUrl: '',
    version: '1.5',
    periodStart: '2026-09-02T07:00:00+08:00',
    periodEnd: '2026-09-30T12:00:00+08:00',
    featured: [{ name: '提弗洛斯', period: 11 }],
  },
  {
    id: '1.4-linuo',
    poolId: 'special_1_4_2',
    title: '「晨星于此闪耀」特许寻访',
    subtitle: '梨诺',
    description: '',
    imageUrl: '/images/banners/梨诺.webp',
    officialUrl: '',
    version: '1.4',
    periodStart: '2026-08-09T12:00:00+08:00',
    periodEnd: '2026-09-02T06:00:00+08:00',
    featured: [{ name: '梨诺', period: 10 }],
  },
  {
    id: '1.4-jue',
    poolId: 'special_1_4_1',
    title: '「临渊望北」特许寻访',
    subtitle: '诀',
    description: '开放时间：「向渊行」版本开启后 - 2026/08/09 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：诀\n\n全部可能出现的6星干员：诀/卡缪/弭弗/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【踞渊北眺寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/jue.webp',
    officialUrl: '',
    version: '1.4',
    periodStart: '2026-07-16T07:00:00+08:00',
    periodEnd: '2026-08-09T12:00:00+08:00',
    featured: [{ name: '诀', period: 9 }],
  },
  {
    id: '1.3-kamiu',
    poolId: 'special_1_3_2',
    title: '「逐罪者」特许寻访',
    subtitle: '卡缪',
    description: '开放时间：2026/06/26 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：卡缪\n\n全部可能出现的6星干员：卡缪/弭弗/庄方宜/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【夜趋逐罪寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/kamiu.webp',
    officialUrl: '',
    version: '1.3',
    periodStart: '2026-06-26T12:00:00+08:00',
    periodEnd: '2026-07-16T06:00:00+08:00',
    featured: [{ name: '卡缪', period: 8 }],
  },
  {
    id: '1.3-mifu',
    poolId: 'special_1_3_1',
    title: '「拳出无悔」特许寻访',
    subtitle: '弭弗',
    description: '开放时间：「寻遗散记」版本开启后 - 2026/06/26 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：弭弗\n\n全部可能出现的6星干员：弭弗/庄方宜/洛茜/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【拳与心合寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/mifu.webp',
    officialUrl: '',
    version: '1.3',
    periodStart: '2026-06-05T07:00:00+08:00',
    periodEnd: '2026-06-26T12:00:00+08:00',
    featured: [{ name: '弭弗', period: 7 }],
  },
  {
    id: '1.2-huiguangqingdian',
    poolId: 'joint_1_2_2',
    title: '「辉光庆典」特殊寻访',
    subtitle: '莱万汀 / 洁尔佩塔 / 艾尔黛拉 / 骏卫',
    description: '「辉光庆典」属于「春晓时」版本专属的特殊寻访，为本次特别安排而开放，采用仅适用于本次特殊寻访的专属规则。\n\n开放时间：2026/05/14 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n全部可能出现的6星干员包括：莱万汀/洁尔佩塔/艾尔黛拉/骏卫。\n\n可使用【流光庆时寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 「辉光庆典」不会纳入现有的寻访类型与规则，与其他寻访互不影响。',
    imageUrl: '/images/banners/huiguagnqingdian.webp',
    officialUrl: '',
    version: '1.2',
    periodStart: '2026-05-14T12:00:00+08:00',
    periodEnd: '2026-06-05T06:00:00+08:00',
    featured: [
      { name: '莱万汀', isRerun: true, versionLabel: '1.2「春晓时」' },
      { name: '洁尔佩塔', isRerun: true, versionLabel: '1.2「春晓时」' },
    ],
  },
  {
    id: '1.2-zhuangfangyi',
    poolId: 'special_1_2_1',
    title: '「春雷动，万物生」特许寻访',
    subtitle: '庄方宜',
    description: '开放时间：「春晓时」版本开启后 - 2026/05/22 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：庄方宜\n\n全部可能出现的6星干员：庄方宜/洛茜/汤汤/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【春雷醒物寻访凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/zhuangfangyi.webp',
    officialUrl: '',
    version: '1.2',
    periodStart: '2026-04-17T07:00:00+08:00',
    periodEnd: '2026-05-22T12:00:00+08:00',
    featured: [{ name: '庄方宜', period: 6, versionLabel: '1.2「春晓时」新六星' }],
  },
  {
    id: '1.1-luoxi',
    poolId: 'special_1_1_2',
    title: '「狼珀」特许寻访',
    subtitle: '洛茜',
    description: '开放时间：2026/03/29 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：洛茜\n\n全部可能出现的6星干员：洛茜/汤汤/伊冯/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【狼群瑰宝寻访凭证】【狼群瑰宝十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/luoxi.webp',
    officialUrl: '',
    version: '1.1',
    periodStart: '2026-03-29T12:00:00+08:00',
    periodEnd: '2026-04-17T06:00:00+08:00',
    featured: [{ name: '洛茜', period: 5, offRateNote: 'bannerCalendar.offRateNote.luoxi', versionLabel: '1.1「新潮起，故渊离」下半' }],
  },
  {
    id: '1.1-tangtang',
    poolId: 'special_1_1_1',
    title: '「河流的女儿」特许寻访',
    subtitle: '汤汤',
    description: '开放时间：「新潮起，故渊离」版本开启后 - 2026/03/29 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：汤汤\n\n全部可能出现的6星干员：汤汤/伊冯/洁尔佩塔/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【清波静流寻访凭证】【清波静流十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/tangtang.webp',
    officialUrl: '',
    version: '1.1',
    periodStart: '2026-03-12T07:00:00+08:00',
    periodEnd: '2026-03-29T12:00:00+08:00',
    featured: [{ name: '汤汤', period: 4, offRateNote: 'bannerCalendar.offRateNote.tangtang', versionLabel: '1.1「新潮起，故渊离」上半' }],
  },
  {
    id: '1.0-yifeng',
    poolId: 'special_1_0_2',
    title: '「热烈色彩」特许寻访',
    subtitle: '伊冯',
    description: '开放时间：2026/02/24 12:00（服务器时间） - 版本更新维护前\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：伊冯\n\n全部可能出现的6星干员：伊冯/洁尔佩塔/莱万汀/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【异彩斑斓寻访凭证】【异彩斑斓十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/yifeng.webp',
    officialUrl: '',
    version: '1.0',
    periodStart: '2026-02-24T12:00:00+08:00',
    periodEnd: '2026-03-12T06:00:00+08:00',
    featured: [{ name: '伊冯', period: 3, versionLabel: '1.0「零号委托」下半' }],
  },
  {
    id: '1.0-jieerpeita',
    poolId: 'special_1_0_3',
    title: '「轻飘飘的信使」特许寻访',
    subtitle: '洁尔佩塔',
    description: '开放时间：2026/02/07 12:00 - 2026/02/24 11:59（服务器时间）\n\n开放条件：完成主线任务「第一章 - 进程Ⅰ - 基地解围」\n\n概率提升的6星干员：洁尔佩塔\n\n全部可能出现的6星干员：洁尔佩塔/伊冯/莱万汀/余烬/黎风/艾尔黛拉/别礼/骏卫\n\n可使用【灵动信使寻访凭证】【灵动信使十连凭证】【特许寻访凭证】或【嵌晶玉】进行寻访。\n\n※ 在「特许寻访」中概率提升的6星干员，将于3次「特许寻访」结束后，移出全部可能出现的干员列表。移出后，概率提升的6星干员不会进入「基础寻访」。',
    imageUrl: '/images/banners/jieerpeita.webp',
    officialUrl: '',
    version: '1.0',
    periodStart: '2026-02-07T12:00:00+08:00',
    periodEnd: '2026-02-24T12:00:00+08:00',
    featured: [{ name: '洁尔佩塔', period: 2, versionLabel: '1.0「零号委托」中半' }],
  },
  {
    id: '1.0-laiwanting',
    poolId: 'special_1_0_1',
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

/**
 * 每角色的 UP 窗口 (只读 bannerEntries)。
 *
 * 时间/UP 名单/复刻标记在**同步时**已由 `scripts/lib/update-banner-file.ts` 按客户端数据
 * 就地写进上面的条目 (公告口径差几小时属预期差, 同步日志会逐条列出改了什么);
 * 客户端还没下发的未来档期保留手写值。运行时不合并第二份数据。
 */
export const bannerSchedule: BannerSchedule = buildBannerSchedule(bannerEntries, PENDING_SCHEDULE)
