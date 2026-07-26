import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addWallpaperLocale,
  DEFAULT_WALLPAPER_ASPECT_RATIO,
  fetchDailyWallpapers,
  formatWallpaperDate,
  MAX_WALLPAPER_ASPECT_RATIO,
  MIN_WALLPAPER_ASPECT_RATIO,
  resolveWallpaperAspectRatio,
} from '@/lib/daily-wallpapers'

afterEach(() => vi.restoreAllMocks())

describe('fetchDailyWallpapers', () => {
  it('validates and resolves feed URLs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serverDate: '2026-07-23',
        current: {
          contentDate: '2026-07-22',
          isToday: false,
          imageUrl: '/media/wallpapers/2026-07-22',
          actionUrl: '/go/wallpaper/2026-07-22',
        },
        history: [],
      }),
    }))

    const result = await fetchDailyWallpapers('https://end-ops.canmoe.com/api/v1/wallpapers')
    expect(result.current?.imageUrl).toBe('https://end-ops.canmoe.com/media/wallpapers/2026-07-22')
    expect(result.current?.actionUrl).toBe('https://end-ops.canmoe.com/go/wallpaper/2026-07-22')
    expect(fetch).toHaveBeenCalledWith(
      'https://end-ops.canmoe.com/api/v1/wallpapers',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('rejects malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ current: null }) }))
    await expect(fetchDailyWallpapers('https://end-ops.canmoe.com/api/v1/wallpapers')).rejects.toMatchObject({ code: 'invalidResponse' })
  })

  it('rejects malformed items, empty URL strings, and oversized history', async () => {
    const validItem = { contentDate: '2026-07-22', isToday: false, imageUrl: null, actionUrl: null }
    const feeds = [
      { serverDate: '2026-07-23', current: { ...validItem, isToday: 'yes' }, history: [] },
      { serverDate: '2026-07-23', current: { ...validItem, imageUrl: '' }, history: [] },
      { serverDate: '2026-07-23', current: null, history: [{ ...validItem, contentDate: 'not-a-date' }] },
      { serverDate: '2026-07-23', current: null, history: Array.from({ length: 15 }, () => validItem) },
    ]
    for (const feed of feeds) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => feed }))
      await expect(fetchDailyWallpapers('https://end-ops.canmoe.com/api/v1/wallpapers')).rejects.toMatchObject({ code: 'invalidResponse' })
    }
  })

  it('strips unknown fields from validated items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serverDate: '2026-07-23',
        current: { contentDate: '2026-07-22', isToday: true, imageUrl: null, actionUrl: null, extra: 'field' },
        history: [],
      }),
    }))

    const result = await fetchDailyWallpapers('https://end-ops.canmoe.com/api/v1/wallpapers')
    expect(result.current).toEqual({ contentDate: '2026-07-22', isToday: true, imageUrl: null, actionUrl: null })
  })

  it('preserves AbortError thrown while decoding JSON', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw abortError },
    }))
    await expect(fetchDailyWallpapers('https://end-ops.canmoe.com/api/v1/wallpapers')).rejects.toBe(abortError)
  })

  it('rejects calendar-invalid dates in a feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ serverDate: '2026-02-30', current: null, history: [] }),
    }))
    await expect(fetchDailyWallpapers('https://end-ops.canmoe.com/api/v1/wallpapers')).rejects.toMatchObject({ code: 'invalidResponse' })
  })
})

describe('wallpaper helpers', () => {
  it('formats date-only values without timezone drift', () => {
    expect(formatWallpaperDate('2026-07-23', 'en')).toBe('July 23, 2026')
  })

  it('returns calendar-invalid dates unchanged and accepts leap day', () => {
    expect(formatWallpaperDate('2026-02-30', 'en')).toBe('2026-02-30')
    expect(formatWallpaperDate('2024-02-29', 'en')).toBe('February 29, 2024')
  })

  it('adds the locale to redirect URLs', () => {
    expect(addWallpaperLocale('https://end-ops.canmoe.com/go/wallpaper/2026-07-23', 'zh-CN')).toContain('locale=zh-CN')
  })

  it('clamps measured wallpaper aspect ratios', () => {
    expect(resolveWallpaperAspectRatio(1920, 1080)).toBeCloseTo(16 / 9)
    expect(resolveWallpaperAspectRatio(1080, 1920)).toBeCloseTo(MIN_WALLPAPER_ASPECT_RATIO)
    expect(resolveWallpaperAspectRatio(3200, 900)).toBeCloseTo(MAX_WALLPAPER_ASPECT_RATIO)
    expect(resolveWallpaperAspectRatio(0, 1080)).toBe(DEFAULT_WALLPAPER_ASPECT_RATIO)
  })
})
