import { describe, expect, it } from 'vitest'
import { parseAdFeed, buildAdClickBeaconUrl, ADS_ENDPOINT } from './ads'

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
    expect(buildAdClickBeaconUrl(7, '/zh-CN/essence-planner', 'zh-CN')).toBe(
      'https://end-ops.canmoe.com/api/v1/creatives/7/click?path=%2Fzh-CN%2Fessence-planner&locale=zh-CN'
    )
  })
})
