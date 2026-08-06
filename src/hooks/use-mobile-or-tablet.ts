import { useSyncExternalStore } from 'react'

export interface DeviceSignals {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
  userAgentDataMobile?: boolean
  coarsePointer?: boolean
  noHover?: boolean
}

const MOBILE_USER_AGENT_MARKERS = [
  'android',
  'iphone',
  'ipod',
  'ipad',
  'mobile',
  'silk',
  'kindle',
  'windows phone',
  'opera mini',
  'iemobile',
]

/**
 * 判断当前设备是否为手机或平板。
 *
 * 采用多信号融合, 优先放行, 避免误拦:
 * 1. User-Agent 中的移动设备标识 (Android / iPhone / iPad / Kindle 等)
 * 2. userAgentData.mobile 明确上报移动形态
 * 3. iPadOS 请求桌面版网站时伪装成 Mac: MacIntel + 多点触控
 * 4. 纯触摸平板兜底: 多点触控 + 粗指针 + 无悬停 (覆盖隐藏 UA 的平板)
 *
 * 触屏笔记本 (coarse + 有 hover) 与普通 PC 不会命中第 4 条, 仍被拦截。
 */
export function isMobileOrTabletDevice(signals: DeviceSignals): boolean {
  const userAgent = signals.userAgent.toLowerCase()
  if (MOBILE_USER_AGENT_MARKERS.some((marker) => userAgent.includes(marker))) return true
  if (signals.userAgentDataMobile === true) return true

  const platform = (signals.platform ?? '').toLowerCase()
  const isMacintosh = platform === 'macintel' || platform === 'macintosh' || platform === 'mac'
  if (isMacintosh && (signals.maxTouchPoints ?? 0) > 1) return true

  const hasCoarsePointer = signals.coarsePointer === true
  const hasNoHover = signals.noHover === true
  if ((signals.maxTouchPoints ?? 0) > 0 && hasCoarsePointer && hasNoHover) return true

  return false
}

interface NavigatorUADataLike {
  mobile: boolean
}

function readBrowserSignals(): DeviceSignals {
  const hasNavigator = typeof navigator !== 'undefined'
  const userAgent = hasNavigator ? navigator.userAgent : ''
  const platform = hasNavigator ? navigator.platform : undefined
  const maxTouchPoints = hasNavigator ? navigator.maxTouchPoints : 0
  const userAgentData =
    hasNavigator && 'userAgentData' in navigator
      ? (navigator.userAgentData as NavigatorUADataLike)
      : undefined
  const coarsePointer =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false
  const noHover =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: none)').matches
      : false
  return {
    userAgent,
    platform,
    maxTouchPoints,
    userAgentDataMobile: userAgentData?.mobile,
    coarsePointer,
    noHover,
  }
}

/**
 * 手机/平板判定 Hook。静态导出阶段默认返回 false (按 PC 渲染禁用态),
 * 客户端水合后依据真实设备信号决定是否放行。订阅 (pointer: coarse)
 * 媒体查询, 在触控能力变化 (如平板外接键鼠) 时重新评估。
 */
export function useIsMobileOrTablet(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mediaQuery = window.matchMedia('(pointer: coarse)')
      mediaQuery.addEventListener('change', callback)
      return () => mediaQuery.removeEventListener('change', callback)
    },
    () => isMobileOrTabletDevice(readBrowserSignals()),
    () => false,
  )
}
