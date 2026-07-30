// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WeeklyWallpaperSection } from '@/components/background-preview/weekly-wallpaper-section'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (values?.range) return `${key}:${values.range}`
    if (values?.date) return `${key}:${values.date}`
    return key
  },
}))

vi.mock('next/image', () => ({
  default: ({
    alt = '',
    src,
    onLoad,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <span
      role="img"
      aria-label={alt}
      data-src={String(src)}
      data-loading={props.loading}
      data-testid="wallpaper-image"
      onClick={() => {
        const target = {
          naturalWidth: 1080,
          naturalHeight: 1920,
        } as HTMLImageElement
        onLoad?.({ currentTarget: target } as React.SyntheticEvent<HTMLImageElement>)
      }}
    />
  ),
}))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})
afterEach(cleanup)
it('renders weekly items and a working action button', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      serverDate: '2026-07-29',
      weekStart: '2026-07-26',
      displayUntil: '2026-08-01',
      isActive: true,
      weekItems: [{
        id: '2026-07-26',
        imageUrl: 'https://end-ops.canmoe.com/media/wallpapers/2026-07-26',
      }],
      actionUrl: 'https://end-ops.canmoe.com/go/wallpaper/2026-07-26',
      history: [],
    }),
  }))

  render(<WeeklyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText('weeklyUpdatedBadge')).toBeTruthy())
  const action = screen.getByRole('button', { name: 'getWeeklyWallpaper' })
  expect(action).toBeTruthy()
})

it('shows empty state when no items', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      serverDate: '2026-07-29',
      weekStart: '2026-07-26',
      displayUntil: '2026-08-01',
      isActive: true,
      weekItems: [],
      actionUrl: null,
      history: [],
    }),
  }))

  render(<WeeklyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText('weeklyEmpty')).toBeTruthy())
})

it('shows fallback description when not active', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      serverDate: '2026-08-10',
      weekStart: '2026-07-26',
      displayUntil: '2026-08-01',
      isActive: false,
      weekItems: [{
        id: '2026-07-26',
        imageUrl: 'https://end-ops.canmoe.com/media/wallpapers/2026-07-26',
      }],
      actionUrl: 'https://end-ops.canmoe.com/go/wallpaper/2026-07-26',
      history: [],
    }),
  }))

  render(<WeeklyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText(/weeklyFallbackDescription/)).toBeTruthy())
})

it('shows a clear request failure and retries', async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        serverDate: '2026-07-29',
        weekStart: '2026-07-26',
        displayUntil: '2026-08-01',
        isActive: true,
        weekItems: [],
        actionUrl: null,
        history: [],
      }),
    })
  vi.stubGlobal('fetch', fetchMock)

  render(<WeeklyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText('dailyErrors.requestFailed')).toBeTruthy())
  screen.getByRole('button', { name: 'retry' }).click()
  await waitFor(() => expect(screen.getByText('weeklyEmpty')).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
