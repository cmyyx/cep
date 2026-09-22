// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseAdFeed,
  buildAdClickBeaconUrl,
  buildAdImpressionBeaconUrl,
  getAdSessionId,
  resetAdSessionForTests,
  ADS_ENDPOINT,
} from './ads'

describe('parseAdFeed', () => {
  const validAd = {
    id: 1,
    title: 'campaign',
    desktopImageUrl: 'https://end-ops.canmoe.com/media/creatives/1/desktop',
    mobileImageUrl: 'https://end-ops.canmoe.com/media/creatives/1/mobile',
    targetUrl: 'https://example.com/campaign',
  }

  it('accepts a valid feed and preserves ad order', () => {
    const feed = parseAdFeed({ serverTime: '2026-01-01T00:00:00Z', ads: [validAd, { ...validAd, id: 2, targetUrl: null }] })
    expect(feed).not.toBeNull()
    expect(feed?.serverTime).toBe('2026-01-01T00:00:00Z')
    expect(feed?.ads).toHaveLength(2)
    expect(feed?.ads[0].id).toBe(1)
    expect(feed?.ads[1].targetUrl).toBeNull()
  })

  it('accepts single-slot ads: one image URL null, the other present', () => {
    const feed = parseAdFeed({
      serverTime: 't',
      ads: [
        { ...validAd, mobileImageUrl: null },
        { ...validAd, id: 2, desktopImageUrl: null },
      ],
    })
    expect(feed?.ads).toHaveLength(2)
    expect(feed?.ads[0].mobileImageUrl).toBeNull()
    expect(feed?.ads[0].desktopImageUrl).toBeTypeOf('string')
    expect(feed?.ads[1].desktopImageUrl).toBeNull()
    expect(feed?.ads[1].mobileImageUrl).toBeTypeOf('string')
  })

  it('accepts an empty title (alt falls back on the frontend)', () => {
    const feed = parseAdFeed({ serverTime: 't', ads: [{ ...validAd, title: '' }] })
    expect(feed?.ads).toHaveLength(1)
    expect(feed?.ads[0].title).toBe('')
  })

  it('drops ads with neither creative', () => {
    const feed = parseAdFeed({
      serverTime: 't',
      ads: [validAd, { ...validAd, desktopImageUrl: null, mobileImageUrl: null }],
    })
    expect(feed?.ads).toHaveLength(1)
  })

  it('rejects degenerate https URLs (bare scheme, empty host)', () => {
    // 单端非法：该端视为无素材（mobile 仍有效，条目保留）
    for (const bad of ['https://', 'https:///', 'https://:18921/x', 'http://end-ops.canmoe.com', '/relative.png']) {
      const single = parseAdFeed({ serverTime: 't', ads: [{ ...validAd, desktopImageUrl: bad }] })
      expect(single?.ads).toHaveLength(1)
      expect(single?.ads[0].desktopImageUrl).toBeNull()
      expect(single?.ads[0].mobileImageUrl).toBeTypeOf('string')
    }
    // 两端同时为裸 scheme（无法渲染任何一端）→ 整条丢弃
    const dropped = parseAdFeed({ serverTime: 't', ads: [{ ...validAd, desktopImageUrl: 'https://', mobileImageUrl: 'https://' }] })
    expect(dropped?.ads).toHaveLength(0)
  })

  it('rejects non-object / missing serverTime / non-array ads', () => {
    expect(parseAdFeed(null)).toBeNull()
    expect(parseAdFeed('x')).toBeNull()
    expect(parseAdFeed({ ads: [] })).toBeNull()
    expect(parseAdFeed({ serverTime: '', ads: [] })).toBeNull()
    expect(parseAdFeed({ serverTime: 't', ads: {} })).toBeNull()
  })

  it('drops ads with invalid id / title / targetUrl', () => {
    const feed = parseAdFeed({
      serverTime: 't',
      ads: [
        validAd,
        null,
        { ...validAd, id: 'x' },
        { ...validAd, id: 0 },
        { ...validAd, id: -3 },
        { ...validAd, title: 1 },
        { ...validAd, targetUrl: 'javascript:alert(1)' },
      ],
    })
    expect(feed?.ads).toHaveLength(1)
    expect(feed?.ads[0].id).toBe(1)
  })

  it('exposes the ops-service endpoint and builds beacon urls', () => {
    expect(ADS_ENDPOINT).toBe('https://end-ops.canmoe.com/api/v1/creatives.json')
    expect(buildAdClickBeaconUrl(7, 'desktop', '/zh-CN/essence-planner', 'zh-CN')).toBe(
      'https://end-ops.canmoe.com/api/v1/creatives/7/click?slot=desktop&path=%2Fzh-CN%2Fessence-planner&locale=zh-CN'
    )
  })
})

describe('ad session id and impression beacon', () => {
  const SESSION = '0f9a6c1e-3d2b-4f5a-8c7d-6e5f4a3b2c1d'

  afterEach(() => {
    vi.unstubAllGlobals()
    window.sessionStorage.clear()
    resetAdSessionForTests()
  })

  it('keeps one id per tab in sessionStorage and sends it with the impression beacon', () => {
    vi.stubGlobal('crypto', { randomUUID: () => SESSION })
    resetAdSessionForTests()

    expect(getAdSessionId()).toBe(SESSION)
    expect(getAdSessionId()).toBe(SESSION) // 同一标签页内稳定
    expect(window.sessionStorage.getItem('cep-ad-session')).toBe(SESSION)
    expect(buildAdImpressionBeaconUrl(7, 'desktop', '/zh-CN/planner', 'zh-CN')).toBe(
      `https://end-ops.canmoe.com/api/v1/creatives/7/impression?slot=desktop&path=%2Fzh-CN%2Fplanner&locale=zh-CN&sid=${SESSION}`
    )
  })

  it('omits the session id when the browser cannot create one', () => {
    vi.stubGlobal('crypto', {})
    resetAdSessionForTests()

    expect(getAdSessionId()).toBe('')
    expect(buildAdImpressionBeaconUrl(7, 'mobile', '/zh-CN/', 'zh-CN')).toBe(
      'https://end-ops.canmoe.com/api/v1/creatives/7/impression?slot=mobile&path=%2Fzh-CN%2F&locale=zh-CN'
    )
  })

  it('degrades to an in-memory id when sessionStorage throws', () => {
    vi.stubGlobal('crypto', { randomUUID: () => SESSION })
    const getItem = vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    const setItem = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    resetAdSessionForTests()
    try {
      expect(getAdSessionId()).toBe(SESSION)
      expect(getAdSessionId()).toBe(SESSION)
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})
