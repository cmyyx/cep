// @vitest-environment jsdom

import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMobileLongPressTooltip } from './use-mobile-long-press-tooltip'

vi.mock('./use-mobile', () => ({
  useIsMobile: () => true,
}))

vi.mock('./use-close-on-scroll', () => ({
  useCloseOnScroll: () => useRef<HTMLButtonElement>(null),
}))

function LongPressHarness() {
  const {
    open,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
  } = useMobileLongPressTooltip()
  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
    >
      {open ? 'open' : 'closed'}
    </button>
  )
}

describe('useMobileLongPressTooltip', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('opens after a primary touch long press', () => {
    render(<LongPressHarness />)
    const trigger = screen.getByRole('button')

    fireEvent.pointerDown(trigger, { pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(300))

    expect(trigger.textContent).toBe('open')
  })

  it('closes immediately when a long press turns into scrolling', () => {
    render(<LongPressHarness />)
    const trigger = screen.getByRole('button')

    fireEvent.pointerDown(trigger, { pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 })
    act(() => vi.advanceTimersByTime(300))
    fireEvent.pointerMove(trigger, { pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 24 })

    expect(trigger.textContent).toBe('closed')
  })

  it('does not open after movement cancels the pending long press', () => {
    render(<LongPressHarness />)
    const trigger = screen.getByRole('button')

    fireEvent.pointerDown(trigger, { pointerType: 'touch', isPrimary: true, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(trigger, { pointerType: 'touch', isPrimary: true, clientX: 22, clientY: 10 })
    act(() => vi.advanceTimersByTime(300))

    expect(trigger.textContent).toBe('closed')
  })
})
