// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GrowthFloatingPicker } from './growth-floating-picker'

const viewport = vi.hoisted(() => ({ isMobile: false }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => viewport.isMobile,
}))

vi.mock('@/components/growth-planner/growth-entity-picker', () => ({
  GrowthEntityPicker: () => <div data-testid="growth-entity-picker" />,
}))

afterEach(() => {
  cleanup()
  viewport.isMobile = false
})

it('leaves only the left handle in the viewport until hovered', () => {
  const { container } = render(<GrowthFloatingPicker />)
  const rail = container.querySelector<HTMLElement>('[data-growth-floating-picker]')
  const handle = screen.getByRole('button', { name: 'pickerRail' })

  expect(rail).not.toBeNull()
  expect(rail?.dataset.expanded).toBe('false')
  expect(rail?.className).toContain('-right-128')
  expect(rail?.firstElementChild).toBe(handle)

  fireEvent.pointerEnter(rail!)

  expect(rail?.dataset.expanded).toBe('true')
  expect(rail?.className).toContain('right-0')
  expect(screen.getByTestId('growth-entity-picker')).not.toBeNull()

  fireEvent.pointerLeave(rail!)
  expect(rail?.dataset.expanded).toBe('false')
})

it('keeps the picker expanded after the handle pins it', () => {
  const { container } = render(<GrowthFloatingPicker />)
  const rail = container.querySelector<HTMLElement>('[data-growth-floating-picker]')

  fireEvent.click(screen.getByRole('button', { name: 'pickerRail' }))
  fireEvent.pointerLeave(rail!)

  expect(rail?.dataset.expanded).toBe('true')
  expect(screen.getByRole('button', { name: 'pickerRail' }).getAttribute('aria-expanded')).toBe('true')

  fireEvent.keyDown(window, { key: 'Escape' })
  expect(rail?.dataset.expanded).toBe('false')
})

it('does not render the floating picker on mobile', () => {
  viewport.isMobile = true
  const { container } = render(<GrowthFloatingPicker />)

  expect(container.childElementCount).toBe(0)
})
