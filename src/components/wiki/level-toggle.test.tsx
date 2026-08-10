// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LevelToggle } from './level-toggle'

afterEach(cleanup)

it('renders the expand label and toggles on click', () => {
  const onToggle = vi.fn()
  render(<LevelToggle showAll={false} onToggle={onToggle} collapseLabel="收起" expandLabel="展开" />)

  const button = screen.getByRole('button', { name: '展开' })
  fireEvent.click(button)
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('renders the collapse label when expanded', () => {
  render(<LevelToggle showAll onToggle={() => {}} collapseLabel="收起" expandLabel="展开" />)
  expect(screen.getByRole('button', { name: '收起' })).toBeTruthy()
})
