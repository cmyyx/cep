import { OPS_SERVICE_ORIGIN } from '@/lib/constants'
import type { AdFeed, AdItem } from '@/types/ad'

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
