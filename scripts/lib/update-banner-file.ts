// 把客户端卡池数据直接写进 `src/data/banner.ts` —— 与武器/装备同样的做法:
// 数据只有一个落点 (banner.ts), 不再有并行的生成文件在运行时合并。
// ================================================================================
// 每次同步会:
//   1. 按 `poolId` (首次同步时写入) 精确关联上游卡池; 没有 poolId 的条目按 "UP 角色 + 同日开池" 关联
//   2. 用上游**实际时间**覆盖 `periodStart` / `periodEnd` (公告口径 12:00 与客户端口径 07:00 的差是预期差)
//   3. 补上前瞻/复刻标记 `isRerun` (上游池型 = rerun)
//   4. 核查但不覆盖手写内容: `title` 是否含上游池名、`featured` 是否覆盖上游 UP 名单
// 上游还没下发的条目 (未来档期) 原样保留手写值; 上游有窗口却没有条目的会记 issue。
// ================================================================================

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { GachaPool } from './gacha-pools'

export interface BannerUpdateResult {
  content: string
  /** 已按上游更新/关联的条目 */
  updated: Array<{ entryId: string; poolId: string; changes: string[] }>
  /** 核查不通过 (标题/UP 名单) 与上游有窗口但无条目的情况 */
  issues: string[]
  /** 上游还没下发的条目 (保留手写值) */
  pending: string[]
  /** 命中的例外 (站点口径与客户端不同), 每个同步都打印, 便于复核 */
  notes: string[]
}

/**
 * 站点口径与客户端不同的例外 —— **逐条写清原因**, 不是"跳过检查"的开关。
 * key = 客户端卡池 id。
 */
const POOL_EXCEPTIONS: Record<string, { keepHandWrittenSchedule?: string }> = {
  // 1.0 莱万汀池: 客户端这条档期(2025-12-09)是三次测试期, 公测开池以手写 2026-01-22 为准
  special_1_0_1: { keepHandWrittenSchedule: '上游档期属三次测试 (2025-12), 非公测' },
}

/** 标题形如 「池名」特许寻访 / 「池名」重构寻访 —— 池名以客户端为准, 后缀保留。 */
const TITLE_NAME = /^(\s*title: ')「[^」]*」(.*)('.*)$/

interface EntryBlock {
  /** 在 lines 里的起止下标 (含) */
  from: number
  to: number
  id: string
  title: string
  periodStart: string
  periodEnd: string
  poolId: string | null
  featuredNames: string[]
  hidden: boolean
}

const ENTRY_START = /^ {2}\{$/
const ENTRY_END = /^ {2}\},$/

/** 拆出 `bannerEntries` 里的条目块 (按缩进识别, 不依赖完整解析 TS)。 */
function parseEntries(lines: string[]): EntryBlock[] {
  const blocks: EntryBlock[] = []
  let current: EntryBlock | null = null
  let inFeatured = false
  lines.forEach((line, index) => {
    if (!current) {
      if (ENTRY_START.test(line)) {
        current = { from: index, to: index, id: '', title: '', periodStart: '', periodEnd: '', poolId: null, featuredNames: [], hidden: false }
      }
      return
    }
    if (ENTRY_END.test(line)) {
      current.to = index
      if (current.id) blocks.push(current)
      current = null
      inFeatured = false
      return
    }
    const text = line.trim()
    const id = /^id: '([^']+)',/.exec(text)?.[1]
    if (id) current.id = id
    const title = /^title: '([^']*)',/.exec(text)?.[1]
    if (title !== undefined) current.title = title
    const start = /^periodStart: '([^']+)',/.exec(text)?.[1]
    if (start) current.periodStart = start
    const end = /^periodEnd: '([^']+)',/.exec(text)?.[1]
    if (end) current.periodEnd = end
    const poolId = /^poolId: '([^']+)',/.exec(text)?.[1]
    if (poolId) current.poolId = poolId
    if (text.startsWith('hidden: true')) current.hidden = true
    // featured 可以是单行或多行数组: 从 `featured:` 开始收集, 直到出现 `]`
    if (text.startsWith('featured:')) inFeatured = true
    if (inFeatured) {
      for (const match of line.matchAll(/name: '([^']+)'/g)) current.featuredNames.push(match[1])
      if (text.includes(']')) inFeatured = false
    }
  })
  return blocks
}

function sameDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10)
}

/**
 * 找一个条目与上游卡池对应, 优先级:
 *   1. `poolId` 精确 (同步写过一次之后就走这条, 最稳)
 *   2. `title` 含上游池名 (覆盖"手写条目是版本级/日期不准"的情况, 例如 1.2 辉光庆典)
 *   3. UP 角色名 + 同日开池 (首次关联的兜底)
 * 候选必须唯一, 多于一个就交给人确认 (返回 null 由调用方报 issue)。
 */
function findEntry(blocks: EntryBlock[], pool: GachaPool, upNames: string[]): EntryBlock | null {
  const byPoolId = blocks.filter((block) => block.poolId === pool.poolId)
  if (byPoolId.length === 1) return byPoolId[0]
  if (byPoolId.length > 1) return null
  const unlinked = blocks.filter((block) => !block.poolId)
  // 标题只是"同名"证据, 必须同时有 UP 角色佐证: 上游池名可能很通用 (如「启程寻访」),
  // 单靠标题会把无关条目认成这条卡池, 之后按 poolId 一直错下去。
  const byTitle = pool.title
    ? unlinked.filter((block) => block.title.includes(pool.title) && block.featuredNames.some((name) => upNames.includes(name)))
    : []
  const candidates = byTitle.length > 0
    ? byTitle
    : unlinked.filter((block) => sameDay(block.periodStart, pool.start) && block.featuredNames.some((name) => upNames.includes(name)))
  return candidates.length === 1 ? candidates[0] : null
}

/**
 * 在 `content` 内按上游更新卡池档期。纯函数, 便于 fixture 测试。
 *
 * @param nameByCharacterId 客户端角色 id -> 简中名 (用于比对 featured)
 */
export function updateBannerEntries(
  content: string,
  pools: GachaPool[],
  nameByCharacterId: Record<string, string>,
): BannerUpdateResult {
  // 仓库里的 banner.ts 是 CRLF; 按文件自己的换行符切分, 避免整文件被改成 LF
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(eol)
  const blocks = parseEntries(lines)
  const updated: BannerUpdateResult['updated'] = []
  const issues: string[] = []
  const pending: string[] = []
  const notes: string[] = []
  const matchedEntryIds = new Set<string>()

  for (const pool of pools) {
    const upNames = pool.upCharacterIds.map((id) => nameByCharacterId[id]).filter((name): name is string => Boolean(name))
    const block = findEntry(blocks, pool, upNames)
    if (!block) {
      issues.push(`上游卡池 ${pool.poolId}${pool.title ? ` (${pool.title})` : ''} 在 banner.ts 里没有唯一对应条目 (${pool.start.slice(0, 10)})`)
      continue
    }
    matchedEntryIds.add(block.id)
    // 认领标记 (避免同一轮里另一个卡池再匹配到同一条目) 与"文件里本来就有 poolId"要分开记
    const alreadyLinked = block.poolId !== null
    block.poolId = pool.poolId
    const changes: string[] = []
    // 日期差超过一天不是"维护提前结束"能解释的, 只报告不覆盖 (可能手写档期是另一档/版本级)
    const sameDate = sameDay(block.periodStart, pool.start)
    const exception = POOL_EXCEPTIONS[pool.poolId]

    if (exception?.keepHandWrittenSchedule) {
      notes.push(`${block.id} (${pool.poolId}): 保留手写档期 — ${exception.keepHandWrittenSchedule}`)
    } else if (sameDate) {
      for (let index = block.from; index <= block.to; index += 1) {
        const line = lines[index]
        const start = /^(\s*)periodStart: '([^']+)',/.exec(line)
        if (start && start[2] !== pool.start) {
          lines[index] = `${start[1]}periodStart: '${pool.start}',`
          changes.push(`periodStart ${start[2]} -> ${pool.start}`)
        }
        const end = /^(\s*)periodEnd: '([^']+)',/.exec(line)
        if (end && pool.end && end[2] !== pool.end) {
          lines[index] = `${end[1]}periodEnd: '${pool.end}',`
          changes.push(`periodEnd ${end[2]} -> ${pool.end}`)
        }
      }
    } else {
      issues.push(`${block.id}: 上游档期 ${pool.start.slice(0, 10)} 与手写 ${block.periodStart.slice(0, 10)} 相差超过一天 — 未覆盖, 需人工确认`)
    }

    // 复刻标记: 上游池型是唯一真源
    if (pool.kind === 'rerun') {
      for (let index = block.from; index <= block.to; index += 1) {
        const line = lines[index]
        if (!line.trim().startsWith('featured:') || line.includes('isRerun')) continue
        const next = line.replace(/\{ name: '([^']+)'/, "{ name: '$1', isRerun: true")
        if (next !== line) {
          lines[index] = next
          changes.push('isRerun: true (上游复刻池)')
        }
      }
    }

    // 上游已下发 -> 占位条目不再是占位
    if (block.hidden) {
      const hiddenIndex = lines.findIndex((line, index) => index >= block.from && index <= block.to && /^\s*hidden: true,\s*$/.test(line))
      if (hiddenIndex >= 0) {
        lines.splice(hiddenIndex, 1)
        block.to -= 1
        changes.push('hidden 去掉 (上游已下发该卡池)')
      }
    }

    // 关联键: 首次同步写入 poolId, 之后按它精确匹配
    if (!alreadyLinked) {
      const idIndex = lines.findIndex((line, index) => index >= block.from && index <= block.to && /^\s*id: '[^']+',$/.test(line))
      if (idIndex >= 0) {
        const indent = /^(\s*)/.exec(lines[idIndex])?.[1] ?? '    '
        lines.splice(idIndex + 1, 0, `${indent}poolId: '${pool.poolId}',`)
        block.to += 1
        changes.push(`poolId: ${pool.poolId}`)
      }
    }

    // 标题: 池名以客户端为准 (站点表现与公告文案不影响池名)
    if (pool.title) {
      const titleIndex = lines.findIndex((line, index) => index >= block.from && index <= block.to && /^\s*title: '[^']*',$/.test(line))
      if (titleIndex >= 0) {
        const current = lines[titleIndex]
        if (!current.includes(pool.title)) {
          const match = TITLE_NAME.exec(current)
          if (match) {
            lines[titleIndex] = `${match[1]}「${pool.title}」${match[2]}${match[3]}`
            changes.push(`title 池名 -> 「${pool.title}」`)
          } else {
            issues.push(`${block.id}: title ${JSON.stringify(current.trim())} 不含上游池名 "${pool.title}" 且不是「」格式 — 需人工确认`)
          }
        }
      }
    }
    const missing = upNames.filter((name) => !block.featuredNames.includes(name))
    if (missing.length > 0) {
      issues.push(`${block.id}: featured 缺少上游 UP 角色 (${missing.join(', ')}) — 需人工确认`)
    }

    if (changes.length > 0) updated.push({ entryId: block.id, poolId: pool.poolId, changes })
  }

  for (const block of blocks) {
    // hidden 是"日期待公布"的占位, 本来就不指望上游; 只列出真正等上游的条目
    if (!block.hidden && !matchedEntryIds.has(block.id)) pending.push(`${block.id} (${block.title || block.id})`)
  }

  return { content: lines.join(eol), updated, issues, pending, notes }
}

/** 读取 `src/data/banner.ts`, 按上游更新 (updateMode) 或只报告。 */
export function updateBannerFile(
  bannerTsPath: string,
  pools: GachaPool[],
  nameByCharacterId: Record<string, string>,
  updateMode: boolean,
): Omit<BannerUpdateResult, 'content'> {
  if (!existsSync(bannerTsPath)) return { updated: [], issues: ['banner.ts 不存在'], pending: [], notes: [] }
  const content = readFileSync(bannerTsPath, 'utf-8')
  const result = updateBannerEntries(content, pools, nameByCharacterId)
  if (updateMode && result.content !== content) writeFileSync(bannerTsPath, result.content, 'utf-8')
  return { updated: result.updated, issues: result.issues, pending: result.pending, notes: result.notes }
}
