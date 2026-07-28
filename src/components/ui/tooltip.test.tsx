// @vitest-environment jsdom

import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import {
  PLANNER_GRID_TOOLTIP_OPEN_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

function ControlledTooltip() {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider delay={PLANNER_GRID_TOOLTIP_OPEN_DELAY_MS}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger render={<Button type="button">{open ? 'open' : 'closed'}</Button>} />
        <TooltipContent>preview</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('applies the provider delay before opening a controlled tooltip', () => {
  vi.useFakeTimers()
  render(<ControlledTooltip />)
  const trigger = screen.getByRole('button')

  fireEvent.pointerEnter(trigger, { pointerType: 'mouse' })
  fireEvent.mouseEnter(trigger)
  fireEvent.mouseMove(trigger, { movementX: 2, movementY: 0 })
  expect(trigger.textContent).toBe('closed')

  act(() => vi.advanceTimersByTime(PLANNER_GRID_TOOLTIP_OPEN_DELAY_MS - 1))
  expect(trigger.textContent).toBe('closed')

  act(() => vi.advanceTimersByTime(1))
  expect(trigger.textContent).toBe('open')
})
