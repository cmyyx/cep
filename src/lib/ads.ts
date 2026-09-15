import { OPS_SERVICE_ORIGIN } from '@/lib/constants'
import type { AdFeed, AdItem, AdSlotName } from '@/types/ad'

/** 广告位公共端点（运营服务）。 */
export const ADS_ENDPOINT = `${OPS_SERVICE_ORIGIN}/api/v1/creatives.json`

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value === 'https://') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.length > 0
  } catch {
    return false
  }
}

function parseAdItem(raw: unknown): AdItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'number' || !Number.isInteger(r.id) || r.id <= 0) return null
  if (typeof r.title !== 'string') return null
  // 每端素材可空（后端只要求至少一端有图）；URL 非法则视为该端无素材。
  const desktop = r.desktopImageUrl === null ? null : isHttpsUrl(r.desktopImageUrl) ? r.desktopImageUrl : null
  const mobile = r.mobileImageUrl === null ? null : isHttpsUrl(r.mobileImageUrl) ? r.mobileImageUrl : null
  if (desktop === null && mobile === null) return null
  if (r.targetUrl !== null && !isHttpsUrl(r.targetUrl)) return null
  return {
    title: r.title,
    id: r.id,
    desktopImageUrl: desktop,
    mobileImageUrl: mobile,
    targetUrl: r.targetUrl ?? null,
  }
}

/**
 * 严格校验广告载荷。任何结构不符都返回 null —— 无效载荷不会覆盖当前展示状态。
 */
export function parseAdFeed(raw: unknown): AdFeed | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.serverTime !== 'string' || r.serverTime.length === 0) return null
  if (!Array.isArray(r.ads)) return null
  const ads: AdItem[] = []
  for (const item of r.ads) {
    const ad = parseAdItem(item)
    if (ad) ads.push(ad)
  }
  return { serverTime: r.serverTime, ads }
}

/**
 * 拉取当前生效的广告。网络失败 / 非 2xx / 载荷畸形均返回 null（不抛出）。
 */
export async function fetchAdFeed(signal?: AbortSignal): Promise<AdFeed | null> {
  try {
    const response = await fetch(ADS_ENDPOINT, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok) return null
    return parseAdFeed(await response.json())
  } catch {
    return null
  }
}

/**
 * 构建 ad 点击上报的 beacon URL（POST，无请求体，page path 与 locale 走 query）。
 * 跳转本身不经过后端 —— 点击时 navigator.sendBeacon 异步上报，不阻塞新标签页打开。
 */
export function buildAdClickBeaconUrl(adId: number, path: string, locale: string): string {
  const params = new URLSearchParams({ path, locale })
  return `${OPS_SERVICE_ORIGIN}/api/v1/creatives/${adId}/click?${params.toString()}`
}

/** 会话 id 在 sessionStorage 中的键。 */
const AD_SESSION_STORAGE_KEY = 'cep-ad-session'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 进程内回退：sessionStorage 不可用（无痕 / 隐私设置）时的会话 id。 */
let memorySessionId: string | null = null

function createSessionId(): string {
  // crypto.randomUUID 只在安全上下文存在（线上是 https，localhost 也算安全上下文）。
  // 没有它就返回空串：服务端照常记录这次展示，只是不计入“独立访客”。
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return ''
}

/**
 * 返回本标签页的广告会话 id（sessionStorage 中的随机 UUID），关闭标签页即失效。
 *
 * 它只为“独立访客”服务：运营商的 CGNAT 会把很多访客压进同一个 IP，手机的动态地址
 * 又会把同一个访客拆成很多个，会话 id 让去重不再依赖网络地址。它不做跨会话持久化，
 * 因此不是长期标识符。sessionStorage 读写全部兜底：Safari 无痕模式写入会抛异常，
 * 统计绝不能因此影响渲染。
 */
export function getAdSessionId(): string {
  if (memorySessionId !== null) return memorySessionId
  try {
    const stored = window.sessionStorage.getItem(AD_SESSION_STORAGE_KEY)
    if (stored !== null && UUID_PATTERN.test(stored)) {
      memorySessionId = stored
      return stored
    }
  } catch {
    // 存储被禁用：走下面的内存回退
  }
  const created = createSessionId()
  memorySessionId = created
  try {
    window.sessionStorage.setItem(AD_SESSION_STORAGE_KEY, created)
  } catch {
    // 写不进去就用内存值，功能不受影响
  }
  return created
}

/**
 * 构建展示上报的 beacon URL（POST，无请求体，slot / sid / path / locale 走 query）。
 * 与点击 beacon 同构：简单请求，不触发 CORS 预检；服务端永远回 204。
 */
export function buildAdImpressionBeaconUrl(adId: number, slot: AdSlotName, path: string, locale: string): string {
  const params = new URLSearchParams({ slot, path, locale })
  const sessionId = getAdSessionId()
  if (sessionId !== '') params.set('sid', sessionId)
  return `${OPS_SERVICE_ORIGIN}/api/v1/creatives/${adId}/impression?${params.toString()}`
}

/** 测试助手 —— 重置进程内的会话 id 回退值。 */
export function resetAdSessionForTests(): void {
  memorySessionId = null
}
