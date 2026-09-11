// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))
vi.mock('@/hooks/use-ad-polling', () => ({ useAdPolling: () => {} }))

import { MobileAdBanner } from './mobile-ad-banner'
import { resetAdStoreForTests, useAdStore } from '@/stores/useAdStore'
import type { AdItem } from '@/types/ad'

const AD: AdItem = {
  id: 9,
  title: 'campaign',
  desktopImageUrl: 'https://end-ops.canmoe.com/media/creatives/9/desktop',
  mobileImageUrl: 'https://end-ops.canmoe.com/media/creatives/9/mobile',
  targetUrl: 'https://example.com/campaign',
}

beforeEach(() => {
  resetAdStoreForTests()
})

afterEach(cleanup)

it('无生效广告时外层容器不留纵向占位（留白改挂 AdSlot，随 null 一起消失）', () => {
  const { container } = render(<MobileAdBanner />)
  expect(container.querySelector('img')).toBeNull()
  const wrapper = container.firstElementChild
  expect(wrapper).not.toBeNull()
  expect(wrapper?.className).not.toContain('pt-3')
  expect(wrapper?.className).not.toContain('pb-1')
})

it('有移动端素材时把上下留白挂在广告根元素上', () => {
  useAdStore.setState({ currentAd: AD })
  const { container } = render(<MobileAdBanner />)
  const img = container.querySelector('img')
  expect(img?.getAttribute('src')).toBe(AD.mobileImageUrl)
  const adRoot = img?.parentElement
  expect(adRoot?.className).toContain('mt-3')
  expect(adRoot?.className).toContain('mb-1')
})

it('只有桌面素材时不渲染（该端无素材）', () => {
  useAdStore.setState({ currentAd: { ...AD, mobileImageUrl: null } })
  const { container } = render(<MobileAdBanner />)
  expect(container.querySelector('img')).toBeNull()
})
