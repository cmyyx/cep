// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { WikiTable, WikiTableFrame } from './wiki-table'

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

it('keeps controls in an attached footer outside the scroll region', () => {
  render(
    <WikiTableFrame footer={<button type="button">Expand</button>}>
      <WikiTable><tbody><tr><td>Level</td></tr></tbody></WikiTable>
    </WikiTableFrame>,
  )

  const button = screen.getByRole('button', { name: 'Expand' })
  expect(button.parentElement?.parentElement?.className).toContain('overflow-hidden')
  expect(button.closest('[class*="overflow-auto"]')).toBeNull()
  expect(button.parentElement?.className).toContain('shadow-[inset_0_1px_0_0_rgba(0,0,0,0.08)]')
})
