// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { WikiMaterialRef } from '@/lib/wiki-material-compact'
import {
  useExpandedWikiMaterials,
  WikiMaterialCatalogProvider,
} from './wiki-material-catalog'

afterEach(cleanup)

function Probe({ materials }: { materials: WikiMaterialRef[] }) {
  const rows = useExpandedWikiMaterials(materials)
  return (
    <span data-testid="probe">
      {rows.map((row) => `${row.name}:${row.iconId}:${row.rarity}:${row.count}`).join('|')}
    </span>
  )
}

it('expands material refs using the provided catalog', () => {
  render(
    <WikiMaterialCatalogProvider
      catalog={{ 'mat-a': { name: '材料甲', iconId: 'icon-a', rarity: 5 } }}
    >
      <Probe materials={[{ itemId: 'mat-a', count: 3 }]} />
    </WikiMaterialCatalogProvider>,
  )

  expect(screen.getByTestId('probe').textContent).toBe('材料甲:icon-a:5:3')
})

it('falls back to the item id and rarity 1 without a surrounding provider', () => {
  render(<Probe materials={[{ itemId: 'mat-b', count: 2 }]} />)

  expect(screen.getByTestId('probe').textContent).toBe('mat-b:mat-b:1:2')
})

it('resolves refs missing from the catalog with safe fallbacks', () => {
  render(
    <WikiMaterialCatalogProvider
      catalog={{ 'mat-a': { name: '材料甲', iconId: 'icon-a', rarity: 5 } }}
    >
      <Probe materials={[{ itemId: 'mat-unknown', count: 7 }]} />
    </WikiMaterialCatalogProvider>,
  )

  expect(screen.getByTestId('probe').textContent).toBe('mat-unknown:mat-unknown:1:7')
})
