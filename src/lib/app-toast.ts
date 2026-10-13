/**
 * App-level toast channel.
 *
 * 数据导入结果这类"应用消息"必须和同步通知走同一处通知堆（SyncNotifier），
 * 各自渲染 fixed bottom-6 right-6 会重叠在一起。堆里每条通知独立存活，
 * 应用消息不会被别的通知阻塞。SyncNotifier 挂载时注册 handler；没人监听时静默丢弃。
 */

export type AppToastTone = 'success' | 'error'

export interface AppToastEvent {
  tone: AppToastTone
  /** 已翻译好的正文（调用方自带 useTranslations）。 */
  text: string
}

type AppToastHandler = (event: AppToastEvent) => void

let handler: AppToastHandler | null = null

export function setAppToastHandler(next: AppToastHandler | null): void {
  handler = next
}

/** Show a transient app message in the shared toast slot. */
export function showAppToast(event: AppToastEvent): void {
  handler?.(event)
}

/** Whether a toast surface is currently mounted (tests / diagnostics). */
export function hasAppToastHandler(): boolean {
  return handler !== null
}
