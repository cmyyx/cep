import { OPS_SERVICE_ORIGIN } from '@/lib/constants'
import { parseBootstrapPayload } from '@/lib/bootstrap-notice'
import type { BootstrapNotice } from '@/types/bootstrap'

/**
 * 公告的单一状态源 (useSyncExternalStore 的外部 store)。
 * 页面初始化和运行期间都从这里同步公告状态；网络失败不会覆盖当前状态。
 */

/** 公告端点。 */
export const NOTICE_POLL_ENDPOINT = `${OPS_SERVICE_ORIGIN}/api/v1/notice.json`

/** 轮询间隔 —— 与版本检查 (use-version.tsx) 保持同一节奏。 */
export const NOTICE_POLL_INTERVAL_MS = 5 * 60 * 1000

/** 标签页恢复可见后的立即刷新冷却窗口, 防止频繁切标签打爆运营服务。 */
export const NOTICE_VISIBILITY_REFRESH_CD_MS = 30 * 1000

let snapshot: BootstrapNotice | null = null
/** 当前快照的序列化形态; undefined = 还没有任何数据源写入过。 */
let snapshotKey: string | undefined
const listeners = new Set<() => void>()

let pollConsumers = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let visibilityHandler: (() => void) | null = null
let inFlight: AbortController | null = null
let lastFetchStartedAt = 0

function publish(notice: BootstrapNotice | null): void {
  const key = JSON.stringify(notice)
  if (snapshotKey === key) return
  snapshotKey = key
  snapshot = notice
  // 复制一份再遍历: 订阅者在回调里退订 (React 重渲染 → 卸载) 不该影响本轮派发。
  for (const listener of [...listeners]) listener()
}

/** 消费并校验公告载荷; 无效载荷不会覆盖当前公告。 */
export function ingestNoticePayload(raw: unknown): void {
  const payload = parseBootstrapPayload(raw)
  if (!payload) return
  publish(payload.notice)
}

/** useSyncExternalStore 的 subscribe。 */
export function subscribeNotice(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getNoticeSnapshot(): BootstrapNotice | null {
  return snapshot
}

/** SSG 快照恒为 null —— 首屏不渲染任何内容, 避免 hydration 不一致。 */
export function getNoticeServerSnapshot(): BootstrapNotice | null {
  return null
}

async function fetchNotice(): Promise<void> {
  if (typeof window === 'undefined') return
  // 上一次还没回来就再次触发时, 丢掉旧请求, 避免慢响应反超。
  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller
  lastFetchStartedAt = Date.now()
  try {
    const response = await fetch(NOTICE_POLL_ENDPOINT, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok || inFlight !== controller) return
    const payload = await response.json()
    if (inFlight !== controller) return
    ingestNoticePayload(payload)
  } catch {
    // 网络失败 / 超时 / 主动中断 / JSON 畸形都不改变当前展示状态。
  } finally {
    if (inFlight === controller) inFlight = null
  }
}

function attachPolling(): void {
  pollTimer = setInterval(() => {
    // 后台标签页不发请求; 恢复可见时由 visibilitychange 立即补一次。
    if (document.visibilityState !== 'visible') return
    void fetchNotice()
  }, NOTICE_POLL_INTERVAL_MS)

  visibilityHandler = () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastFetchStartedAt < NOTICE_VISIBILITY_REFRESH_CD_MS) return
    void fetchNotice()
  }
  document.addEventListener('visibilitychange', visibilityHandler)
}

function detachPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  inFlight?.abort()
  inFlight = null
}

/** 启动公告同步, 返回清理函数。多个消费者时只运行一份定时器。 */
export function startNoticePolling(): () => void {
  if (typeof window === 'undefined') return () => undefined
  pollConsumers += 1
  if (pollConsumers === 1) {
    attachPolling()
    void fetchNotice()
  }
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    pollConsumers -= 1
    if (pollConsumers === 0) detachPolling()
  }
}

/** 测试助手 —— 重置模块级状态与监听, 让每个用例都从"没有任何数据"开始。 */
export function resetNoticeStoreForTests(): void {
  detachPolling()
  pollConsumers = 0
  listeners.clear()
  snapshot = null
  snapshotKey = undefined
  lastFetchStartedAt = 0
}
