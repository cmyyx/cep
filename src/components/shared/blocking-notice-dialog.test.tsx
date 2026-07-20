// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { BlockingNoticeDialog } from './blocking-notice-dialog'

afterEach(cleanup)

it('stays open when the backdrop is pressed', () => {
  render(<BlockingNoticeDialog title="Blocked" description="Upgrade required" />)

  expect(screen.getByRole('dialog')).toBeTruthy()
  fireEvent.pointerDown(document.querySelector('[data-slot="dialog-overlay"]')!)
  fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]')!)

  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull()
})

it('renders a footer only when actions are provided', () => {
  const { rerender } = render(
    <BlockingNoticeDialog title="Blocked" description="Upgrade required">
      <span>Refresh</span>
    </BlockingNoticeDialog>,
  )

  expect(document.querySelector('[data-slot="dialog-footer"]')?.textContent).toContain('Refresh')

  rerender(<BlockingNoticeDialog title="Blocked" description="Upgrade required" />)
  expect(document.querySelector('[data-slot="dialog-footer"]')).toBeNull()
})
