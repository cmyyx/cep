// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MergedLevelTable, type MergedLevelColumn } from './merged-level-table'

afterEach(cleanup)

interface TestRow {
  level: number
  value: string
  material?: string
}

const rows: TestRow[] = [
  { level: 1, value: '10%', material: 'A' },
  { level: 2, value: '10%', material: 'B' },
  { level: 3, value: '30%', material: 'C' },
]

const columns: MergedLevelColumn<TestRow>[] = [
  { key: 'level', header: '等级', value: (row) => String(row.level), sticky: true, cellClassName: 'font-geist-mono' },
  { key: 'value', header: '伤害', value: (row) => row.value, cellClassName: 'text-center font-geist-mono' },
  {
    key: 'material',
    header: '材料',
    headerClassName: 'text-center',
    value: () => '—',
    render: (row) => <span>材料{row.material}</span>,
    cellClassName: 'text-center',
    lock: false,
    merge: false,
  },
]

function wrap(ui: React.ReactNode) {
  return render(ui)
}

it('renders the sticky header and sticky first column', () => {
  wrap(
    <MergedLevelTable
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.level)}
      collapsedRows={(all) => all.slice(-1)}
      collapseLabel="收起"
      expandLabel="展开"
    />,
  )

  const ths = [...document.querySelectorAll('thead th')]
  expect(ths[0].className).toContain('sticky left-0 z-30 bg-card')
  expect(ths[1].className).toContain('break-words')
  const firstCells = [...document.querySelectorAll('tbody tr:not([aria-hidden]) td:first-child')]
  for (const cell of firstCells) {
    expect(cell.className).toContain('sticky left-0 z-10 bg-card')
  }
})

it('merges adjacent equal values with rowSpan and skips non-merge columns', () => {
  wrap(
    <MergedLevelTable
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.level)}
      collapsedRows={(all) => all.slice(-1)}
      collapseLabel="收起"
      expandLabel="展开"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '展开' }))

  // 伤害列: 前两行 '10%' 合并 (rowSpan=2), 第三行独立。
  const merged = [...document.querySelectorAll('tbody td[rowspan]')]
    .filter((td) => td.getAttribute('rowspan') !== '1')
  expect(merged.length).toBe(1)
  expect(merged[0].getAttribute('rowspan')).toBe('2')
  // 材料列不合并: 每行都有独立的渲染内容。
  expect(screen.getAllByText(/材料[A-C]/)).toHaveLength(3)
})
it('merges the sticky first column when adjacent values match', () => {
  const mergeRows: TestRow[] = [
    { level: 1, value: '10%', material: 'A' },
    { level: 1, value: '20%', material: 'B' },
    { level: 2, value: '30%', material: 'C' },
  ]
  wrap(
    <MergedLevelTable
      columns={columns}
      rows={mergeRows}
      rowKey={(row) => `${row.level}-${row.value}`}
      collapsedRows={(all) => all.slice(-1)}
      collapseLabel="收起"
      expandLabel="展开"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '展开' }))

  // 首列相邻相同值 (1, 1) 合并: 第一行的 sticky 单元格 rowSpan=2, 第二行不渲染首列。
  const stickyCells = [...document.querySelectorAll<HTMLElement>('tbody tr:not([aria-hidden]) td.sticky')]
  expect(stickyCells).toHaveLength(2)
  expect(stickyCells[0].getAttribute('rowspan')).toBe('2')
  expect(stickyCells[1].getAttribute('rowspan')).toBe('1')
})

it('sizing row carries the widest value per column and locks non-sticky column widths', () => {
  wrap(
    <MergedLevelTable
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.level)}
      collapsedRows={(all) => all.slice(-1)}
      collapseLabel="收起"
      expandLabel="展开"
    />,
  )

  const sizingRow = document.querySelector('tbody tr[aria-hidden="true"]')
  expect(sizingRow).toBeTruthy()
  expect(sizingRow?.className).toContain('collapse')
  expect(sizingRow?.textContent).toContain('3')
  expect(sizingRow?.textContent).toContain('30%')

  const sizingCells = [...document.querySelectorAll<HTMLElement>('tbody tr[aria-hidden="true"] td')]
  // 首列 (sticky) 不锁定; 数值列锁定为恰好内容宽; 材料列 (lock: false) 不锁定。
  expect(sizingCells[0].style.minWidth).toBe('')
  expect(sizingCells[1].style.minWidth).toBe('calc(3ch + 16px)')
  expect(sizingCells[2].style.minWidth).toBe('')
})
it('collapsed state shows only the rows returned by collapsedRows', () => {
  wrap(
    <MergedLevelTable
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.level)}
      collapsedRows={(all) => all.slice(-1)}
      collapseLabel="收起"
      expandLabel="展开"
    />,
  )

  // 标定行与数据行都渲染 3, 低等级值只出现在展开后。
  expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
  expect(screen.queryByText('1')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '展开' }))
  expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
})
