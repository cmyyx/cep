// @vitest-environment jsdom

import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterChip } from './filter-chip'

afterEach(cleanup)

// Base UI's tooltip needs a portal/provider tree that adds nothing here — the chip's
// own button element is what these assertions are about.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render: node, children }: { render: ReactElement; children: ReactNode }) =>
    cloneElement(node, undefined, children),
  TooltipContent: () => null,
}))

describe('FilterChip', () => {
  it('keeps the tap target at the WCAG 2.5.8 minimum instead of collapsing to ~18px', () => {
    render(<FilterChip value="6" label="6★" isValid isSelected={false} onToggle={() => {}} />)

    const chip = screen.getByRole('button')
    // h-auto cancels the `xs` size height, so min-h-6 (24px) is what guarantees the target.
    expect(chip.className).toContain('min-h-6')
    expect(chip.className).not.toContain('min-h-0')
    expect(chip.className).toContain('py-1')
    expect(chip.className).not.toContain('py-0.5')
  })

  it('keeps invalid chips readable rather than at ~2.2:1 contrast', () => {
    render(<FilterChip value="6" label="6★" isValid={false} isSelected={false} onToggle={() => {}} />)

    const chip = screen.getByRole('button')
    expect(chip.className).toContain('text-muted-foreground/70')
    expect(chip.className).not.toContain('text-muted-foreground/40')
    expect(chip.hasAttribute('disabled')).toBe(true)
  })

  it('stays enabled and pressed when an invalid value is still selected', () => {
    render(<FilterChip value="6" label="6★" isValid={false} isSelected onToggle={() => {}} />)

    const chip = screen.getByRole('button')
    expect(chip.hasAttribute('disabled')).toBe(false)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
  })
})
