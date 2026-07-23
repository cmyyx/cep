// @vitest-environment jsdom

import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useCloseOnScroll } from './use-close-on-scroll'

function Harness() {
  const [open, setOpen] = useState(true)
  const ref = useCloseOnScroll(open, () => setOpen(false))
  return (
    <div>
      <button ref={ref} type="button">{open ? 'open' : 'closed'}</button>
      <div data-slot="tooltip-content">inside tip</div>
    </div>
  )
}

afterEach(cleanup)

it('closes on window wheel outside the tooltip content', () => {
  render(<Harness />)
  expect(screen.getByRole('button').textContent).toBe('open')
  act(() => {
    fireEvent.wheel(window)
  })
  expect(screen.getByRole('button').textContent).toBe('closed')
})

it('does not close when wheel happens inside tooltip content', () => {
  render(<Harness />)
  act(() => {
    fireEvent.wheel(screen.getByText('inside tip'))
  })
  expect(screen.getByRole('button').textContent).toBe('open')
})
