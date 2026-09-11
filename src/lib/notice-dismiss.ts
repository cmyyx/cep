import type { BootstrapNotice } from '@/types/bootstrap'

/**
 * 公告关闭态的单一状态源 (useSyncExternalStore 的外部 store)。
 *
 * 只记"最后一条被关闭的公告"的签名, 不存集合: 同一时刻只有一条公告在下发,
 * 集合会无限增长且需要清理策略。代价是 A 被关掉后切到 B、再切回同一条 A 时
 * A 仍然隐藏 —— 访客已经表达过"不想看这条", 这个结果是对的。
 */

/** localStorage 键。 */
export const NOTICE_DISMISS_STORAGE_KEY = 'cep-notice-dismissed'

/**
 * 公告身份 —— id 与 updatedAt 的组合。它同时是两件事的键:
 *
 * 1. 关闭态: 只按 id 记的话, 运营改了文案 (内容变了) 也永远弹不出来, 关闭就成了
 *    永久静音; 加上 updatedAt 后任何一次编辑都会让横幅对关过它的访客重新出现。
 *    运营改公告的目的就是让人看到新内容, 所以重新弹出是这里唯一正确的方向。
 * 2. 组件的展开/退场等一次性 UI 状态: 用身份做键, 换公告时这些状态自动失效, 不需要
 *    在 effect 里重置 (那会引发级联渲染)。
 */
export function noticeSignature(notice: Pick<BootstrapNotice, 'id' | 'updatedAt'>): string {
  return `${notice.id}@${notice.updatedAt ?? ''}`
}

let dismissed: string | null = null
let hydrated = false
const listeners = new Set<() => void>()
let storageHandler: ((event: StorageEvent) => void) | null = null

function notify(): void {
  // 复制一份再遍历: 订阅者在回调里退订 (React 重渲染 → 卸载) 不该影响本轮派发。
  for (const listener of [...listeners]) listener()
}

/** 首次读取时把 localStorage 灌进内存, 之后快照只读内存。 */
function hydrate(): void {
  if (hydrated) return
  hydrated = true
  if (typeof window === 'undefined') return
  try {
    dismissed = window.localStorage.getItem(NOTICE_DISMISS_STORAGE_KEY)
  } catch {
    // 隐私模式 / 存储被禁用: 关不掉的横幅好过崩掉的页面, 退化为"没有关闭记录"。
    dismissed = null
  }
}

/** useSyncExternalStore 的 subscribe。 */
export function subscribeNoticeDismiss(onStoreChange: () => void): () => void {
  hydrate()
  listeners.add(onStoreChange)
  if (!storageHandler && typeof window !== 'undefined') {
    // 另一个标签页关掉了同一条公告时, 这个标签页不该继续显示它。
    storageHandler = (event: StorageEvent) => {
      if (event.key !== null && event.key !== NOTICE_DISMISS_STORAGE_KEY) return
      hydrate()
      let stored: string | null = null
      try {
        stored = window.localStorage.getItem(NOTICE_DISMISS_STORAGE_KEY)
      } catch {
        stored = null
      }
      if (stored === dismissed) return
      dismissed = stored
      notify()
    }
    window.addEventListener('storage', storageHandler)
  }
  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0 && storageHandler) {
      window.removeEventListener('storage', storageHandler)
      storageHandler = null
    }
  }
}

export function getDismissedSignatureSnapshot(): string | null {
  hydrate()
  return dismissed
}

/** SSG 快照恒为 null —— 首屏不渲染任何内容, 避免 hydration 不一致。 */
export function getDismissedSignatureServerSnapshot(): string | null {
  return null
}

/** 记住一次关闭。写失败 (存储禁用) 时只影响本次会话, 不抛错。 */
export function dismissNotice(notice: Pick<BootstrapNotice, 'id' | 'updatedAt'>): void {
  const signature = noticeSignature(notice)
  dismissed = signature
  hydrated = true
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(NOTICE_DISMISS_STORAGE_KEY, signature)
    } catch {
      // 忽略: 内存里的值已经生效, 本次会话内不会再看到这条公告。
    }
  }
  notify()
}

/**
 * 清除关闭记录 —— 数据清理器用。内存与 localStorage 一起清, 并通知订阅者,
 * 所以横幅会立刻重新出现, 不需要刷新页面。
 */
export function clearNoticeDismissal(): void {
  dismissed = null
  hydrated = true
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(NOTICE_DISMISS_STORAGE_KEY)
    } catch {
      // 忽略: 内存已经清空, 本次会话内横幅会重新出现。
    }
  }
  notify()
}

/** 测试助手 —— 重置模块级状态与监听, 让每个用例都从"没有关闭记录"开始。 */
export function resetNoticeDismissForTests(): void {
  if (storageHandler && typeof window !== 'undefined') {
    window.removeEventListener('storage', storageHandler)
  }
  storageHandler = null
  listeners.clear()
  dismissed = null
  hydrated = false
}
