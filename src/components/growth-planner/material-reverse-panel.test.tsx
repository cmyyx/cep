// @vitest-environment jsdom

import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MaterialReversePanel } from './material-reverse-panel'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

// Wiki translations: itemName falls back to the id, entityName falls back to the id.
vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    itemName: (itemId: string) => itemId,
    entityName: (entity: { id: string }) => entity.id,
    text: (key: string) => key,
    ready: true,
  }),
}))

// Real planner-data-loader: the module-level cache is populated by the
// import-side effect of loadPlannerData().
import { loadPlannerData } from '@/lib/planner/planner-data-loader'

await loadPlannerData()

afterEach(() => {
  cleanup()
})

describe('MaterialReversePanel', () => {
  it('renders the material grid and shows consumers for the selected material', async () => {
    const { container } = render(<MaterialReversePanel />)

    // Every material in the index is rendered as a tile button.
    const gridButtons = container.querySelectorAll('[aria-pressed]')
    expect(gridButtons.length).toBeGreaterThan(10)

    // Gold is consumed by everything: pick the item_gold tile.
    const goldTile = Array.from(gridButtons).find((button) => button.getAttribute('data-item-id') === 'item_gold')
    expect(goldTile).toBeDefined()
    fireEvent.click(goldTile!)

    // Consumers are listed as tiles with a quantity corner badge.
    const consumersSection = screen.getByText('consumers')
    expect(consumersSection).not.toBeNull()
    const quantityBadges = container.querySelectorAll('.font-mono')
    expect(quantityBadges.length).toBeGreaterThan(5)
    // The first consumer (highest consumption) has a non-zero badge.
    const firstBadge = quantityBadges[0]?.textContent ?? ''
    expect(Number(firstBadge.replace(/,/g, ''))).toBeGreaterThan(0)
  })

  it('sorts consumers by consumption descending (ties broken by rarity, then name)', () => {
    const { container } = render(<MaterialReversePanel />)
    const goldTile = Array.from(container.querySelectorAll('[aria-pressed]')).find((button) => button.getAttribute('data-item-id') === 'item_gold')
    fireEvent.click(goldTile!)
    const counts = Array.from(container.querySelectorAll('.font-mono'))
      .map((el) => Number((el.textContent ?? '').replace(/,/g, '')))
    expect(counts.length).toBeGreaterThan(1)
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i])
    }
  })


  it('shows the select hint before any material is chosen', () => {
    render(<MaterialReversePanel />)
    expect(screen.getByText('materialSelectHint')).not.toBeNull()
  })

  it('filters the grid by search query', () => {
    const { container } = render(<MaterialReversePanel />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'item_gold' } })
    const gridButtons = container.querySelectorAll('[aria-pressed]')
    expect(gridButtons.length).toBeGreaterThanOrEqual(1)
    expect(Array.from(gridButtons).every((button) => button.getAttribute('data-item-id') === 'item_gold')).toBe(true)
  })
})
