// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useMobileLongPressTooltip } from './use-mobile-long-press-tooltip'
import {
  ensureTooltipScrollLockInstalled,
  lockTooltipsForScroll,
  resetTooltipScrollLockForTests,
} from '@/lib/tooltip-scroll-lock'

vi.mock('./use-mobile', () => ({
  useIsMobile: () => false,
}))

function DesktopCard({ id }: { id: string }) {
  const { open, handleOpenChange, triggerRef } = useMobileLongPressTooltip()
  return (
    <button
      ref={triggerRef}
      type="button"
      data-testid={id}
      onMouseEnter={() => handleOpenChange(true)}
      onMouseLeave={() => handleOpenChange(false)}
    >
      {open ? `${id}:open` : `${id}:closed`}
    </button>
  )
}

afterEach(() => {
  cleanup()
  resetTooltipScrollLockForTests()
  vi.useRealTimers()
})

it('does not flash reopen after scroll-close while pointer still hovers the trigger', () => {
  vi.useFakeTimers()
  ensureTooltipScrollLockInstalled()
  render(<DesktopCard id="a" />)
  const trigger = screen.getByTestId('a')

  act(() => {
    fireEvent.mouseEnter(trigger)
  })
  expect(trigger.textContent).toBe('a:open')

  Object.defineProperty(trigger, 'matches', {
    configurable: true,
    value: (selector: string) => selector === ':hover',
  })

  act(() => {
    fireEvent.wheel(window)
  })
  expect(trigger.textContent).toBe('a:closed')

  act(() => {
    fireEvent.mouseEnter(trigger)
  })
  expect(trigger.textContent).toBe('a:closed')

  Object.defineProperty(trigger, 'matches', {
    configurable: true,
    value: () => false,
  })
  act(() => {
    fireEvent.mouseLeave(trigger)
  })
  act(() => {
    vi.advanceTimersByTime(400)
  })
  act(() => {
    Object.defineProperty(trigger, 'matches', {
      configurable: true,
      value: (selector: string) => selector === ':hover',
    })
    fireEvent.mouseEnter(trigger)
  })
  expect(trigger.textContent).toBe('a:open')
})

it('does not let a different card flash open under the cursor after scroll', () => {
  vi.useFakeTimers()
  ensureTooltipScrollLockInstalled()
  render(
    <>
      <DesktopCard id="a" />
      <DesktopCard id="b" />
    </>,
  )
  const a = screen.getByTestId('a')
  const b = screen.getByTestId('b')

  act(() => {
    fireEvent.mouseEnter(a)
  })
  expect(a.textContent).toBe('a:open')

  // Capture-phase style: lock first (as window wheel would), then hover retargets to B.
  act(() => {
    lockTooltipsForScroll(400)
    fireEvent.wheel(window)
  })
  expect(a.textContent).toBe('a:closed')

  act(() => {
    Object.defineProperty(b, 'matches', {
      configurable: true,
      value: (selector: string) => selector === ':hover',
    })
    fireEvent.mouseEnter(b)
  })
  expect(b.textContent).toBe('b:closed')

  act(() => {
    vi.advanceTimersByTime(400)
  })
  Object.defineProperty(b, 'matches', {
    configurable: true,
    value: () => false,
  })
  act(() => {
    fireEvent.mouseLeave(b)
  })
  act(() => {
    Object.defineProperty(b, 'matches', {
      configurable: true,
      value: (selector: string) => selector === ':hover',
    })
    fireEvent.mouseEnter(b)
  })
  expect(b.textContent).toBe('b:open')
})

it('force-closes any open card when global lock engages even without local wheel on that card', () => {
  ensureTooltipScrollLockInstalled()
  render(
    <>
      <DesktopCard id="a" />
      <DesktopCard id="b" />
    </>,
  )
  const a = screen.getByTestId('a')
  const b = screen.getByTestId('b')

  act(() => {
    fireEvent.mouseEnter(a)
  })
  expect(a.textContent).toBe('a:open')

  // B opens (group-instant simulation) then global lock fires — both must end closed.
  act(() => {
    fireEvent.mouseEnter(b)
  })
  // Without lock, B may open; then lock force-closes subscribers that are open.
  act(() => {
    lockTooltipsForScroll(400)
  })
  expect(a.textContent).toBe('a:closed')
  expect(b.textContent).toBe('b:closed')
})
