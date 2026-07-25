// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({
  default: ({ src }: { src: string }) => <span role="img" data-src={src} />,
}))
vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => <span>sidebar-trigger</span> }))
vi.mock('@/lib/features', () => ({ FEATURES: { wallpaperApiUrl: 'https://end-a.canmoe.com/api/v1/wallpapers' } }))
vi.mock('@/stores/useSettingsStore', () => ({ useSettingsStore: () => ({ backgroundUrl: '/background.jpg' }) }))
vi.mock('@/components/background-preview/daily-wallpaper-section', () => ({
  DailyWallpaperSection: ({ apiUrl }: { apiUrl: string }) => <span data-testid="daily" data-api-url={apiUrl} />,
}))

import BackgroundPreviewPage from './page'

afterEach(cleanup)

it('preserves click-to-preview and click-to-exit while keeping the daily entry attached', () => {
  render(<BackgroundPreviewPage />)
  expect(screen.getByTestId('daily').getAttribute('data-api-url')).toBe('https://end-a.canmoe.com/api/v1/wallpapers')
  const collection = screen.getByRole('button', { name: 'backgroundPreview.websiteBackgroundCollection' })
  expect(collection.getAttribute('href')).toBe('https://pan.quark.cn/s/27540d6f3706#/list/share')
  fireEvent.click(screen.getByRole('button', { name: 'backgroundPreview.clickHint' }))
  expect(screen.getByRole('dialog', { name: 'nav.backgroundPreview' })).toBeTruthy()
  fireEvent.click(screen.getByRole('dialog', { name: 'nav.backgroundPreview' }))
  expect(screen.queryByRole('dialog', { name: 'nav.backgroundPreview' })).toBeNull()
  expect(screen.getByText('backgroundPreview.disclaimer')).toBeTruthy()
})
