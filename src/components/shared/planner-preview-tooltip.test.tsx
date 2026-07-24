// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlannerPreviewTooltip } from './planner-preview-tooltip'
import { TOOLTIP_OPEN_DELAY_MS } from '@/components/ui/tooltip'

vi.mock('@/hooks/use-mobile-long-press-tooltip', () => ({
  useMobileLongPressTooltip: (enabled = true) => ({
    open: false,
    setOpen: vi.fn(),
    triggerRef: { current: null },
    longPressTriggered: { current: false },
    handleOpenChange: vi.fn(),
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerEnd: vi.fn(),
    handleContextMenu: vi.fn(),
    swallowLongPressClick: () => false,
    isMobile: false,
    enabled,
  }),
}))

afterEach(cleanup)

it('exports a 400ms open delay for the shared provider default', () => {
  expect(TOOLTIP_OPEN_DELAY_MS).toBe(400)
})

it('invokes onClick for cards without preview content', () => {
  const onClick = vi.fn()
  render(
    <PlannerPreviewTooltip content={null} onClick={onClick} aria-label="测试卡">
      <span>卡面</span>
    </PlannerPreviewTooltip>,
  )
  fireEvent.click(screen.getByRole('button', { name: '测试卡' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})

it('still renders an activatable card when preview content is present', () => {
  const onClick = vi.fn()
  render(
    <PlannerPreviewTooltip content={<div>预览</div>} onClick={onClick} aria-label="有预览">
      <span>卡面</span>
    </PlannerPreviewTooltip>,
  )
  fireEvent.click(screen.getByRole('button', { name: '有预览' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
