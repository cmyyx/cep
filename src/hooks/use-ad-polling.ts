'use client'

import { useEffect } from 'react'
import { useAdStore } from '@/stores/useAdStore'

/** 轮询间隔 —— 与公告 / 版本检查保持同一节奏。 */
const AD_POLL_INTERVAL_MS = 5 * 60 * 1000

/** 标签页恢复可见后的立即刷新冷却窗口，防止频繁切标签打爆运营服务。 */
const AD_VISIBILITY_REFRESH_CD_MS = 30 * 1000

// 模块级单例轮询：桌面侧边栏位与移动端顶部 banner 会同时挂载（CSS 各显示一个），
// 多个消费者共享一份定时器，全部卸载后才停止。
let consumers = 0
let timer: ReturnType<typeof setInterval> | null = null
let visibilityHandler: (() => void) | null = null
let lastFetchAt = 0

function refresh(respectCooldown: boolean): void {
  if (document.visibilityState !== 'visible') return
  if (respectCooldown && Date.now() - lastFetchAt < AD_VISIBILITY_REFRESH_CD_MS) return
  lastFetchAt = Date.now()
  void useAdStore.getState().refreshAds()
}

/**
 * 广告轮询 hook。挂载即开始（引用计数），卸载最后一个消费者时停止。
 */
export function useAdPolling(): void {
  useEffect(() => {
    let stopped = false
    consumers += 1
    if (consumers === 1) {
      refresh(false)
      timer = setInterval(() => refresh(false), AD_POLL_INTERVAL_MS)
      visibilityHandler = () => refresh(true)
      document.addEventListener('visibilitychange', visibilityHandler)
    }
    return () => {
      if (stopped) return
      stopped = true
      consumers -= 1
      if (consumers === 0) {
        if (timer !== null) {
          clearInterval(timer)
          timer = null
        }
        if (visibilityHandler !== null) {
          document.removeEventListener('visibilitychange', visibilityHandler)
          visibilityHandler = null
        }
      }
    }
  }, [])
}
