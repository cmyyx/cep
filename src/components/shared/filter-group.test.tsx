// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FilterGroup } from './filter-group'

afterEach(cleanup)

it('renders the group label and one chip per option', () => {
  render(
    <FilterGroup
      label="副属性1"
      chips={[
        { key: '41', label: '智识', valid: true, selected: false, onToggle: () => {} },
        { key: '42', label: '意志', valid: true, selected: false, onToggle: () => {} },
      ]}
    />,
  )
  expect(screen.getByText('副属性1')).toBeTruthy()
  expect(screen.getByRole('button', { name: '智识' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '意志' })).toBeTruthy()
})

it('fires onToggle and reflects the selected state', () => {
  const onToggle = vi.fn()
  render(
    <FilterGroup
      label="副属性1"
      chips={[
        { key: '41', label: '智识', valid: true, selected: true, onToggle },
      ]}
    />,
  )
  const chip = screen.getByRole('button', { name: '智识' })
  expect(chip.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(chip)
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('applies the default chip column grid', () => {
  const { container } = render(
    <FilterGroup label="副属性1" chips={[]} />,
  )
  const grid = container.querySelector('.grid')
  expect(grid?.className).toContain('grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]')
})
