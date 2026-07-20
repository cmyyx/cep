// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { WikiTable } from './wiki-table'

afterEach(cleanup)

it('applies shared inset column dividers while preserving table classes', () => {
  render(
    <WikiTable className="table-fixed">
      <tbody>
        <tr><td>Level</td><td>Value</td></tr>
      </tbody>
    </WikiTable>,
  )

  const table = screen.getByRole('table')
  expect(table.className).toContain('[&_th+th]:shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)]')
  expect(table.className).toContain('[&_td+td]:shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)]')
  expect(table.className).toContain('table-fixed')
})
