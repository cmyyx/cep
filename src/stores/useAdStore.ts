import { create } from 'zustand'
import { fetchAdFeed } from '@/lib/ads'
import type { AdItem } from '@/types/ad'

/**
 * 广告位状态。不持久化 —— 广告生效窗口由服务端时间决定，
 * 每次会话重新拉取（见 hooks/use-ad-polling.ts）。
 */

interface AdState {
  /** 当前生效的广告（feed 中最新的一条）；null = 不渲染任何广告位。 */
  currentAd: AdItem | null
  /** 拉取并应用最新 feed；失败时保持当前状态。 */
  refreshAds: () => Promise<void>
}

// 模块级单调令牌：并发 refreshAds 时（轮询与可见性触发的刷新重叠、慢响应跨过
// 轮询间隔），只有最新请求的响应可以写入 currentAd，慢的旧响应不得覆盖新数据。
let latestAdRequestToken = 0

export const useAdStore = create<AdState>((set) => ({
  currentAd: null,
  refreshAds: async () => {
    const requestToken = ++latestAdRequestToken
    const feed = await fetchAdFeed()
    if (!feed) return
    if (requestToken !== latestAdRequestToken) return
    const next = feed.ads[0] ?? null
    // 仅在广告变化时更新，避免同 id 重复 set 造成无谓渲染。
    if ((useAdStore.getState().currentAd?.id ?? null) === (next?.id ?? null)) return
    set({ currentAd: next })
  },
}))

/** 测试助手 —— 重置模块状态与并发令牌。 */
export function resetAdStoreForTests(): void {
  latestAdRequestToken = 0
  useAdStore.setState({ currentAd: null })
}
