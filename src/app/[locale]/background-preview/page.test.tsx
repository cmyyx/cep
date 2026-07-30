// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({
  default: ({ src }: { src: string }) => <span role="img" data-src={src} />,
}))
vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => <span>sidebar-trigger</span> }))
vi.mock('@/stores/useSettingsStore', () => ({ useSettingsStore: () => ({ backgroundUrl: '/background.jpg' }) }))
vi.mock('@/components/background-preview/daily-wallpaper-section', () => ({
  WeeklyWallpaperSection: ({ apiUrl }: { apiUrl: string }) => <span data-testid="daily" data-api-url={apiUrl} />,
}));

import { OPS_SERVICE_ORIGIN } from '@/lib/constants'
import BackgroundPreviewPage from './page'

afterEach(cleanup)

it('preserves click-to-preview and click-to-exit while keeping the daily entry attached', () => {
  render(<BackgroundPreviewPage />)
  // 壁纸接口地址来自硬编码的运营服务常量, 不再有环境变量开关
  expect(screen.getByTestId('daily').getAttribute('data-api-url')).toBe(`${OPS_SERVICE_ORIGIN}/api/v1/wallpapers`)
  const collection = screen.getByRole('button', { name: 'backgroundPreview.websiteBackgroundCollection' })
  expect(collection.getAttribute('href')).toBe('https://pan.quark.cn/s/27540d6f3706#/list/share')
  const hint = screen.getByRole('button', { name: 'backgroundPreview.clickHint' })
  expect(hint.querySelector('span')?.className).toContain('top-3')
  const dailyPanel = screen.getByTestId('daily').parentElement
  expect(dailyPanel?.className).toContain('max-h-[calc(100%-2.75rem)]')
  fireEvent.click(hint)
  expect(screen.getByRole('dialog', { name: 'nav.backgroundPreview' })).toBeTruthy()
  // 全屏预览由铺满视口的关闭按钮承接点击 (共享 FullscreenImageDialogContent)
  const [clickAnywhere] = screen.getAllByRole('button', { name: 'backgroundPreview.close' })
  fireEvent.click(clickAnywhere)
  expect(screen.queryByRole('dialog', { name: 'nav.backgroundPreview' })).toBeNull()
  expect(screen.getByText('backgroundPreview.disclaimer')).toBeTruthy()
})
