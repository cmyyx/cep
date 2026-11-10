// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./ad-slot', () => ({
  AdSlot: ({ variant, className }: { variant: string; className?: string }) => (
    <div data-testid="ad-slot" data-variant={variant} className={className} />
  ),
}))

afterEach(() => {
  cleanup()
  vi.doUnmock('@/lib/ad-slot-spec')
  vi.resetModules()
})

describe('广告关闭时（ADS_ENABLED=false，默认）', () => {
  it('整块不渲染，不留空条', async () => {
    const { MobileAdBanner } = await import('./mobile-ad-banner')
    const { container } = render(<MobileAdBanner />)
    expect(container.firstElementChild).toBeNull()
  })
})

describe('广告开启时（ADS_ENABLED=true）', () => {
  async function renderWithAdsOn() {
    vi.resetModules()
    vi.doMock('@/lib/ad-slot-spec', () => ({ ADS_ENABLED: true }))
    const { MobileAdBanner } = await import('./mobile-ad-banner')
    return render(<MobileAdBanner />)
  }

  it('只在移动端显示，广告槽位负责所有留白', async () => {
    const { container, getByTestId } = await renderWithAdsOn()
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('md:hidden')
    expect(wrapper?.className).not.toContain('pt-3')
    expect(getByTestId('ad-slot').getAttribute('data-variant')).toBe('mobile')
  })

  it('上下留白挂在槽位上，没有素材时随隐藏节点一起消失', async () => {
    const { getByTestId } = await renderWithAdsOn()
    const slot = getByTestId('ad-slot')
    expect(slot.className).toContain('mt-3')
    expect(slot.className).toContain('mb-1')
  })
})
