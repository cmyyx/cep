// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DailyWallpaperSection } from '@/components/background-preview/daily-wallpaper-section'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: Record<string, string>) => values?.date ? `${key}:${values.date}` : key,
}))

vi.mock('next/image', () => ({
  default: ({ alt = '', src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <span role="img" aria-label={alt} data-src={String(src)} data-loading={props.loading} />,
}))

beforeEach(() => vi.restoreAllMocks())
afterEach(cleanup)

it('renders the latest fallback item and a working support action', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      serverDate: '2026-07-23',
      current: {
        contentDate: '2026-07-22',
        isToday: false,
        imageUrl: 'https://end-a.canmoe.com/media/wallpapers/2026-07-22',
        actionUrl: 'https://end-a.canmoe.com/go/wallpaper/2026-07-22',
      },
      history: [],
    }),
  }))

  render(<DailyWallpaperSection apiUrl="https://end-a.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText(/fallbackDescription/)).toBeTruthy())
  expect(screen.queryByText('promotionBadge')).toBeNull()
  const action = screen.getByRole('button', { name: 'getTodayWallpaper' })
  expect(action.getAttribute('href')).toContain('/go/wallpaper/2026-07-22')
  expect(action.getAttribute('href')).toContain('locale=en')
})

it('keeps the action available when the preview image is missing', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      serverDate: '2026-07-23',
      current: {
        contentDate: '2026-07-23',
        isToday: true,
        imageUrl: null,
        actionUrl: 'https://end-a.canmoe.com/go/wallpaper/2026-07-23',
      },
      history: [],
    }),
  }))

  render(<DailyWallpaperSection apiUrl="https://end-a.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText('imageUnavailable')).toBeTruthy())
  expect(screen.getByRole('button', { name: 'getTodayWallpaper' }).getAttribute('href')).toContain('2026-07-23')
})

it('shows a clear request failure and retries without cached data', async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ serverDate: '2026-07-23', current: null, history: [] }) })
  vi.stubGlobal('fetch', fetchMock)

  render(<DailyWallpaperSection apiUrl="https://end-a.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText('dailyErrors.requestFailed')).toBeTruthy())
  screen.getByRole('button', { name: 'retry' }).click()
  await waitFor(() => expect(screen.getByText('dailyEmpty')).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
