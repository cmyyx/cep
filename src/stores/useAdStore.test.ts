import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdFeed, AdItem } from '@/types/ad'

vi.mock('@/lib/ads', () => ({
  fetchAdFeed: vi.fn(),
}))

import { fetchAdFeed } from '@/lib/ads'
import { resetAdStoreForTests, useAdStore } from './useAdStore'

const ad = (id: number): AdItem => ({
  id,
  title: `campaign ${id}`,
  desktopImageUrl: `https://end-ops.canmoe.com/media/creatives/${id}/desktop`,
  mobileImageUrl: `https://end-ops.canmoe.com/media/creatives/${id}/mobile`,
  targetUrl: null,
})

const feed = (...items: AdItem[]): AdFeed => ({ serverTime: 't', ads: items })

beforeEach(() => {
  vi.mocked(fetchAdFeed).mockReset()
  resetAdStoreForTests()
})

describe('useAdStore.refreshAds', () => {
  it('applies the first ad of the feed', async () => {
    vi.mocked(fetchAdFeed).mockResolvedValue(feed(ad(1), ad(2)))
    await useAdStore.getState().refreshAds()
    expect(useAdStore.getState().currentAd?.id).toBe(1)
  })

  it('clears the current ad when the feed becomes empty', async () => {
    useAdStore.setState({ currentAd: ad(1) })
    vi.mocked(fetchAdFeed).mockResolvedValue(feed())
    await useAdStore.getState().refreshAds()
    expect(useAdStore.getState().currentAd).toBeNull()
  })

  it('keeps the current ad when the fetch fails', async () => {
    useAdStore.setState({ currentAd: ad(1) })
    vi.mocked(fetchAdFeed).mockResolvedValue(null)
    await useAdStore.getState().refreshAds()
    expect(useAdStore.getState().currentAd?.id).toBe(1)
  })

  it('does not update state when the ad id is unchanged', async () => {
    const original = ad(7)
    useAdStore.setState({ currentAd: original })
    // 同 id 不同对象：不应触发 set，currentAd 引用保持不变。
    vi.mocked(fetchAdFeed).mockResolvedValue(feed(ad(7)))
    await useAdStore.getState().refreshAds()
    expect(useAdStore.getState().currentAd).toBe(original)
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    // 手工控制两个并发请求的完成顺序：慢的旧请求后完成。
    let resolveSlow: (value: AdFeed | null) => void = () => {}
    let resolveFast: (value: AdFeed | null) => void = () => {}
    vi.mocked(fetchAdFeed)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFast = resolve }))

    const slow = useAdStore.getState().refreshAds()
    const fast = useAdStore.getState().refreshAds()

    resolveFast(feed(ad(2)))
    await fast
    resolveSlow(feed(ad(1))) // 过期数据后到，不得覆盖
    await slow

    expect(useAdStore.getState().currentAd?.id).toBe(2)
  })
})
