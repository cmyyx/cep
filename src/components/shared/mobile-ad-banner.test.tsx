// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('./adwork-slot', () => ({
  AdworkSlot: ({ variant, className }: { variant: string; className?: string }) => (
    <div data-testid="adwork-slot" data-variant={variant} className={className} />
  ),
}))

import { MobileAdBanner } from './mobile-ad-banner'

afterEach(cleanup)

it('只在移动端显示，广告槽位负责所有留白', () => {
  const { container, getByTestId } = render(<MobileAdBanner />)
  const wrapper = container.firstElementChild
  expect(wrapper?.className).toContain('md:hidden')
  expect(wrapper?.className).not.toContain('pt-3')
  expect(getByTestId('adwork-slot').getAttribute('data-variant')).toBe('mobile')
})

it('上下留白挂在槽位上，关闭后随隐藏节点一起消失', () => {
  const { getByTestId } = render(<MobileAdBanner />)
  const slot = getByTestId('adwork-slot')
  expect(slot.className).toContain('mt-3')
  expect(slot.className).toContain('mb-1')
})
