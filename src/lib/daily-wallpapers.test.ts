import { afterEach, describe, expect, it, vi } from 'vitest'
import { addWallpaperLocale, fetchDailyWallpapers, formatWallpaperDate } from '@/lib/daily-wallpapers'

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

    const result = await fetchDailyWallpapers('https://end-a.canmoe.com/api/v1/wallpapers')
    expect(result.current?.imageUrl).toBe('https://end-a.canmoe.com/media/wallpapers/2026-07-22')
    expect(result.current?.actionUrl).toBe('https://end-a.canmoe.com/go/wallpaper/2026-07-22')
    expect(fetch).toHaveBeenCalledWith(
      'https://end-a.canmoe.com/api/v1/wallpapers',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('rejects malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ current: null }) }))
    await expect(fetchDailyWallpapers('https://end-a.canmoe.com/api/v1/wallpapers')).rejects.toMatchObject({ code: 'invalidResponse' })
  })

  it('preserves AbortError thrown while decoding JSON', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw abortError },
    }))
    await expect(fetchDailyWallpapers('https://end-a.canmoe.com/api/v1/wallpapers')).rejects.toBe(abortError)
  })

  it('rejects calendar-invalid dates in a feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ serverDate: '2026-02-30', current: null, history: [] }),
    }))
    await expect(fetchDailyWallpapers('https://end-a.canmoe.com/api/v1/wallpapers')).rejects.toMatchObject({ code: 'invalidResponse' })
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
    expect(addWallpaperLocale('https://end-a.canmoe.com/go/wallpaper/2026-07-23', 'zh-CN')).toContain('locale=zh-CN')
  })
})
