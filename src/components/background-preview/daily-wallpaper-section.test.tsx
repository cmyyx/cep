// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DailyWallpaperSection } from '@/components/background-preview/daily-wallpaper-section'

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: Record<string, string>) => values?.date ? `${key}:${values.date}` : key,
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
        imageUrl: 'https://end-ops.canmoe.com/media/wallpapers/2026-07-22',
        actionUrl: 'https://end-ops.canmoe.com/go/wallpaper/2026-07-22',
      },
      history: [],
    }),
  }))

  render(<DailyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
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
        actionUrl: 'https://end-ops.canmoe.com/go/wallpaper/2026-07-23',
      },
      history: [],
    }),
  }))

  render(<DailyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText('imageUnavailable')).toBeTruthy())
  expect(screen.getByRole('button', { name: 'getTodayWallpaper' }).getAttribute('href')).toContain('2026-07-23')
})

it('shows a clear request failure and retries without cached data', async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ serverDate: '2026-07-23', current: null, history: [] }) })
  vi.stubGlobal('fetch', fetchMock)

  render(<DailyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
  await waitFor(() => expect(screen.getByText('dailyErrors.requestFailed')).toBeTruthy())
  screen.getByRole('button', { name: 'retry' }).click()
  await waitFor(() => expect(screen.getByText('dailyEmpty')).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('adapts the preview frame to measured image proportions while keeping a height cap', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      serverDate: '2026-07-23',
      current: {
        contentDate: '2026-07-23',
        isToday: true,
        imageUrl: 'https://end-ops.canmoe.com/media/wallpapers/2026-07-23',
        actionUrl: 'https://end-ops.canmoe.com/go/wallpaper/2026-07-23',
      },
      history: [{
        contentDate: '2026-07-22',
        isToday: false,
        imageUrl: 'https://end-ops.canmoe.com/media/wallpapers/2026-07-22',
        actionUrl: 'https://end-ops.canmoe.com/go/wallpaper/2026-07-22',
      }],
    }),
  }))

  const { container } = render(<DailyWallpaperSection apiUrl="https://end-ops.canmoe.com/api/v1/wallpapers" />)
  const previewImage = await waitFor(() => {
    const image = container.querySelector('[data-testid="wallpaper-image"]')
    if (!image) throw new Error('missing preview image')
    return image as HTMLElement
  })
  previewImage.click()
  const preview = previewImage.parentElement
  if (!preview) throw new Error('missing preview frame')

  await waitFor(() => expect(preview.getAttribute('data-aspect-ratio')).toBe('0.7500'))
  expect(preview.className).toContain('max-h-[min(42svh,16rem)]')
  expect(preview.className).toContain('sm:max-h-[min(48svh,28rem)]')
  expect(preview.getAttribute('style') ?? '').toContain('aspect-ratio')

  screen.getByRole('button', { name: 'viewHistory' }).click()
  const historyImage = await waitFor(() => {
    const images = document.querySelectorAll('[data-testid="wallpaper-image"]')
    if (images.length < 2) throw new Error('missing history image')
    return images[1] as HTMLElement
  })
  historyImage.click()
  const historyFrame = historyImage.parentElement
  if (!historyFrame) throw new Error('missing history frame')

  await waitFor(() => expect(historyFrame.getAttribute('data-aspect-ratio')).toBe('0.7500'))
  expect(historyFrame.className).toContain('max-h-[min(36svh,14rem)]')
})
