// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({
  default: ({ src }: { src: string }) => <span role="img" data-src={src} />,
}))
vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => <span>sidebar-trigger</span> }))
vi.mock('@/stores/useSettingsStore', () => ({ useSettingsStore: () => ({ backgroundUrl: '/background.jpg' }) }))

import BackgroundPreviewPage from './page'

afterEach(cleanup)

it('preserves click-to-preview and click-to-exit with the background collection link', () => {
  render(<BackgroundPreviewPage />)
  // 网站背景合集按钮: 纯外链, 不依赖任何后端接口
  const collection = screen.getByRole('button', { name: 'backgroundPreview.websiteBackgroundCollection' })
  expect(collection.getAttribute('href')).toBe('https://pan.quark.cn/s/27540d6f3706#/list/share')
  const hint = screen.getByRole('button', { name: 'backgroundPreview.clickHint' })
  expect(hint.querySelector('span')?.className).toContain('top-3')
  fireEvent.click(hint)
  expect(screen.getByRole('dialog', { name: 'nav.backgroundPreview' })).toBeTruthy()
  // 全屏预览由铺满视口的关闭按钮承接点击 (共享 FullscreenImageDialogContent)
  const [clickAnywhere] = screen.getAllByRole('button', { name: 'backgroundPreview.close' })
  fireEvent.click(clickAnywhere)
  expect(screen.queryByRole('dialog', { name: 'nav.backgroundPreview' })).toBeNull()
  expect(screen.getByText('backgroundPreview.disclaimer')).toBeTruthy()
})
