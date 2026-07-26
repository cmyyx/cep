import { OPS_SERVICE_ORIGIN } from '@/lib/constants'
import { BOOTSTRAP_EVENT_NAME, parseBootstrapPayload } from '@/lib/bootstrap-notice'
import type { BootstrapNotice } from '@/types/bootstrap'

/**
 * 紧急公告的单一状态源 (useSyncExternalStore 的外部 store)。
 *
 * 两个数据源写入同一个槽位, 语义是"最后到达者生效":
 * 1. `<head>` 里 async 的 `/api/v1/bootstrap.js` —— 整页加载时执行一次。可能早于
 *    React (直接读 `window.__cepBootstrap`), 也可能晚到 (等 `cep:bootstrap` 事件)。
 * 2. `/api/v1/notice.json` 轮询 —— 站点是 SPA, 长驻标签页只靠 (1) 会永远停在打开
 *    那一刻的公告。刷新刻意不复用 bootstrap.js: 它可能携带针对特定域名的自定义守卫
 *    脚本, 重复执行会重复触发副作用; notice.json 是不含可执行代码的纯数据端点。
 *
 * 状态收敛在这里而不是散在组件里, 是因为两条来源必须共用一次"是否更新"的判定:
 * - `notice: null` 是**有效状态** (公告已下线), 必须能让已显示的横幅消失;
 * - 网络失败 / 非 2xx / JSON 畸形一律**不改变**当前状态 (见 ingestNoticePayload);
 * - 内容相同的载荷不换引用, 免得每 5 分钟白白重渲染一次横幅。
 */

/** 纯数据公告端点 (无可执行代码, 后端 Cache-Control: public, max-age=60)。 */
export const NOTICE_POLL_ENDPOINT = `${OPS_SERVICE_ORIGIN}/api/v1/notice.json`

/** 轮询间隔 —— 与版本检查 (use-version.tsx) 保持同一节奏。 */
export const NOTICE_POLL_INTERVAL_MS = 5 * 60 * 1000

/** 标签页恢复可见后的立即刷新冷却窗口, 防止频繁切标签打爆运营服务。 */
export const NOTICE_VISIBILITY_REFRESH_CD_MS = 30 * 1000

/** 缓存串分桶粒度, 与端点的 Cache-Control max-age=60 对齐。 */
export const NOTICE_CACHE_BUCKET_MS = 60 * 1000

let snapshot: BootstrapNotice | null = null
/** 当前快照的序列化形态; undefined = 还没有任何数据源写入过。 */
let snapshotKey: string | undefined
const listeners = new Set<() => void>()

/** 已经消费过的 window.__cepBootstrap 引用, 用于区分"新载荷"与"旧值重读"。 */
let ingestedBootstrapRaw: unknown
let hasIngestedBootstrapRaw = false

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

/**
 * 消费一份未校验的载荷 (bootstrap 全局值 / bootstrap 事件 / 轮询响应体)。
 * 非对象载荷视为"没有可信数据", 保持当前状态不动。
 */
export function ingestNoticePayload(raw: unknown): void {
  const payload = parseBootstrapPayload(raw)
  if (!payload) return
  publish(payload.notice)
}

/**
 * 补读 window 上的 bootstrap 载荷。同一个引用只消费一次 —— 否则 locale 切换导致
 * 横幅重挂载时, 会用页面加载时的旧值盖掉轮询刚拿到的新状态。
 */
function ingestWindowBootstrap(): void {
  if (typeof window === 'undefined') return
  const raw = window.__cepBootstrap
  if (raw === undefined) return
  if (hasIngestedBootstrapRaw && raw === ingestedBootstrapRaw) return
  hasIngestedBootstrapRaw = true
  ingestedBootstrapRaw = raw
  ingestNoticePayload(raw)
}

function handleBootstrapEvent(event: Event): void {
  const detail = (event as CustomEvent<unknown>).detail
  // 契约里 detail === window.__cepBootstrap, 回写是幂等的; 但事件载荷才是最新的
  // 事实来源, 所以以它为准回填全局槽位 (脚本漏写 window 时也能拿到)。
  if (detail !== undefined) window.__cepBootstrap = detail
  ingestWindowBootstrap()
}

/** useSyncExternalStore 的 subscribe: 顺带挂上 bootstrap 事件监听并补读全局值。 */
export function subscribeNotice(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener(BOOTSTRAP_EVENT_NAME, handleBootstrapEvent)
  }
  ingestWindowBootstrap()
  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener(BOOTSTRAP_EVENT_NAME, handleBootstrapEvent)
    }
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
  // 上一次还没回来就再次触发 (间隔与可见性刷新撞上) 时, 丢掉旧请求, 避免慢响应反超。
  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller
  lastFetchStartedAt = Date.now()
  try {
    // 缓存串按分钟取整: 端点是 max-age=60, 逐毫秒的串会让每次轮询都成为
    // CDN 未命中并直接打到源站; 按 60 秒分桶后同一分钟内的请求可由边缘缓存
    // 吸收, 而公告最坏也只延迟 60 秒 (远小于 5 分钟的轮询间隔)。
    // cache: 'no-store' 仍保留, 避免浏览器自身的 HTTP 缓存把响应钉死。
    const bucket = Math.floor(Date.now() / NOTICE_CACHE_BUCKET_MS)
    const response = await fetch(`${NOTICE_POLL_ENDPOINT}?t=${bucket}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return
    ingestNoticePayload(await response.json())
  } catch {
    // 静默: 网络失败 / 超时 / 主动中断 / JSON 畸形都不改变当前展示状态,
    // 尤其不能因为一次轮询失败就把正在显示的公告清掉。
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

/**
 * 启动轮询, 返回清理函数 (定时器 + visibilitychange + 在途请求全部撤掉)。
 * 只能在 effect 内调用 (读 document / fetch)。多个消费者时按引用计数, 只跑一份。
 *
 * 刻意**不在挂载时立刻请求一次**: 整页加载已经由 `<head>` 的 bootstrap.js 取过,
 * 挂载即请求会让每次首屏/locale 切换都多打一次运营服务。
 */
export function startNoticePolling(): () => void {
  if (typeof window === 'undefined') return () => undefined
  pollConsumers += 1
  if (pollConsumers === 1) attachPolling()
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
  if (typeof window !== 'undefined') {
    window.removeEventListener(BOOTSTRAP_EVENT_NAME, handleBootstrapEvent)
  }
  snapshot = null
  snapshotKey = undefined
  ingestedBootstrapRaw = undefined
  hasIngestedBootstrapRaw = false
  lastFetchStartedAt = 0
}
