import type {
  BootstrapLocalizedText,
  BootstrapNotice,
  BootstrapNoticeLevel,
  BootstrapPayload,
} from '@/types/bootstrap'
import type { WikiLocale } from '@/types/wiki'


const NOTICE_LEVELS: readonly BootstrapNoticeLevel[] = ['info', 'warning', 'critical']

const NOTICE_LOCALES: readonly WikiLocale[] = ['zh-CN', 'zh-TW', 'ja', 'en']

/** 文案回退链: 当前 locale → zh-CN → en。三者皆缺则不显示。 */
const FALLBACK_LOCALES: readonly WikiLocale[] = ['zh-CN', 'en']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNoticeLevel(value: unknown): value is BootstrapNoticeLevel {
  return typeof value === 'string' && (NOTICE_LEVELS as readonly string[]).includes(value)
}

/** 只保留四个已知 locale 的非空字符串, 其余字段/类型一律丢弃。 */
function parseLocalizedText(value: unknown): BootstrapLocalizedText {
  if (!isRecord(value)) return {}
  const parsed: BootstrapLocalizedText = {}
  for (const locale of NOTICE_LOCALES) {
    const text = value[locale]
    if (typeof text === 'string' && text.trim().length > 0) parsed[locale] = text
  }
  return parsed
}

/**
 * 定向语言列表 (前向兼容, 后端尚未下发): 只接受字符串数组, 逐项 trim 后剔除空串。
 * 其他一切形态 (缺失 / null / 非数组 / 全是垃圾项) 都退化为 undefined = 不限语言。
 * 注意刻意不按已知 locale 白名单过滤: 若后端定向到 `fr`, 过滤后会变成空数组,
 * 被当成"不限语言"而对所有人展示 —— 那是比"谁都看不到"更糟的失败方向。
 */
function parseNoticeLocales(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const locales = (value as unknown[])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return locales.length > 0 ? locales : undefined
}

/**
 * 定向语言命中判断。未定向 (字段缺失或空数组) 时对所有 locale 可见;
 * 定向了但当前 locale 不在列表里 → 不展示。
 */
export function isNoticeVisibleForLocale(
  notice: Pick<BootstrapNotice, 'locales'>,
  locale: string
): boolean {
  if (!notice.locales || notice.locales.length === 0) return true
  return notice.locales.includes(locale)
}

/** 按 "当前 locale → zh-CN → en" 取文案; 全部缺失返回 undefined。 */
export function pickLocalizedText(
  text: BootstrapLocalizedText,
  locale: string
): string | undefined {
  const current = (text as Record<string, string | undefined>)[locale]
  if (current) return current
  for (const fallback of FALLBACK_LOCALES) {
    const candidate = text[fallback]
    if (candidate) return candidate
  }
  return undefined
}

/**
 * 只放行 http(s) 绝对地址与站内绝对路径, 挡掉 `javascript:` / `data:` 与
 * 协议相对地址 (`//evil.example`)。载荷来自网络, 必须自己兜底。
 */
export function sanitizeNoticeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('//')) return undefined
  if (trimmed.startsWith('/')) return trimmed
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    return trimmed
  } catch {
    return undefined
  }
}

/** 逐字段校验单条公告; 缺少 id 或任何语言的标题时返回 null (无法展示)。 */
export function parseBootstrapNotice(value: unknown): BootstrapNotice | null {
  if (!isRecord(value)) return null
  const { id } = value
  if (typeof id !== 'number' || !Number.isFinite(id)) return null
  const title = parseLocalizedText(value.title)
  if (Object.keys(title).length === 0) return null
  return {
    id,
    level: isNoticeLevel(value.level) ? value.level : 'info',
    title,
    body: parseLocalizedText(value.body),
    linkUrl: sanitizeNoticeUrl(value.linkUrl),
    linkLabel: parseLocalizedText(value.linkLabel),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    locales: parseNoticeLocales(value.locales),
  }
}

/** 校验公告接口载荷; 非对象返回 null, 公告畸形则 notice 为 null。 */
export function parseBootstrapPayload(value: unknown): BootstrapPayload | null {
  if (!isRecord(value)) return null
  return {
    notice: parseBootstrapNotice(value.notice),
    serverTime: typeof value.serverTime === 'string' ? value.serverTime : undefined,
  }
}

// 紧急公告横幅不可关闭 (产品决定): 它承载的是维护/故障这类必须送达的信息,
// 因此不提供关闭按钮, 也不再有任何关闭态存储。公告下线由运营在管理端停用,
// 前端通过轮询拿到 notice:null 后自然消失。
