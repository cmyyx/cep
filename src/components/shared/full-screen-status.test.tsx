// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { FullScreenStatus } from './full-screen-status'

afterEach(cleanup)

it('renders shared status content and action slots', () => {
  render(
    <FullScreenStatus
      heading="Access blocked"
      description="Use an official site."
      actions={<a href="https://example.com">example.com</a>}
      footer={<span>Feedback</span>}
    />,
  )

  expect(screen.getByRole('heading', { name: 'CEP' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Access blocked' })).toBeTruthy()
  expect(screen.getByText('Use an official site.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'example.com' })).toBeTruthy()
  expect(screen.getByText('Feedback')).toBeTruthy()
})

it('applies the destructive visual treatment without removing content', () => {
  render(<FullScreenStatus heading="Blocked" tone="destructive" description="Reason" />)

  expect(screen.getByRole('heading', { name: 'Blocked' }).className).toContain('text-ship-red')
  expect(screen.getByText('Reason')).toBeTruthy()
})
