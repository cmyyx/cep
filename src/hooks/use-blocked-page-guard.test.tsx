// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useBlockedPageGuard } from './use-blocked-page-guard'

afterEach(cleanup)

function GuardHarness({ blockedAction, allowedAction }: { blockedAction: () => void; allowedAction: () => void }) {
  useBlockedPageGuard()
  return (
    <div data-blocked-screen="true">
      <button type="button" data-testid="blocked-action" onClick={blockedAction}>Blocked action</button>
      <button type="button" data-blocked-allow="true" data-testid="allowed-action" onClick={allowedAction}>Official site</button>
    </div>
  )
}

it('blocks page interactions except explicitly allowed official links', () => {
  const blockedAction = vi.fn()
  const allowedAction = vi.fn()
  render(<GuardHarness blockedAction={blockedAction} allowedAction={allowedAction} />)

  fireEvent.click(screen.getByTestId('blocked-action'))
  fireEvent.click(screen.getByTestId('allowed-action'))

  expect(blockedAction).not.toHaveBeenCalled()
  expect(allowedAction).toHaveBeenCalledOnce()
})

it('keeps keyboard focus inside the allowed blocked-page actions', () => {
  render(<GuardHarness blockedAction={() => {}} allowedAction={() => {}} />)
  const blockedAction = screen.getByTestId('blocked-action')
  const allowedAction = screen.getByTestId('allowed-action')

  blockedAction.focus()
  fireEvent.focusIn(blockedAction)

  expect(document.activeElement).toBe(allowedAction)
})
