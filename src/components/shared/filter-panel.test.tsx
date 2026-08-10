// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FilterPanel } from './filter-panel'

afterEach(cleanup)

it('toggles the collapse animation classes and fires onToggle', () => {
  const onToggle = vi.fn()
  const { container } = render(
    <FilterPanel title="属性筛选" collapsed onToggle={onToggle}>
      <div>内容</div>
    </FilterPanel>,
  )

  const button = screen.getByRole('button', { name: '属性筛选' })
  expect(button.getAttribute('aria-expanded')).toBe('false')
  const animated = container.querySelector('.grid.transition-all')
  expect(animated?.className).toContain('grid-rows-[0fr]')
  expect(animated?.className).toContain('opacity-0')
  // 折叠时内容容器 inert: 子树不可交互/不可聚焦。
  const contentWrap = animated?.querySelector('.overflow-hidden')
  expect(contentWrap?.hasAttribute('inert')).toBe(true)

  fireEvent.click(button)
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('shows the active count and clear button only when a filter is active', () => {
  const onClear = vi.fn()
  const { container, rerender } = render(
    <FilterPanel title="属性筛选" collapsed={false} onToggle={() => {}} activeCount={0} onClear={onClear} clearLabel="清除">
      <div>内容</div>
    </FilterPanel>,
  )
  expect(screen.queryByText('0')).toBeNull()
  expect(screen.queryByRole('button', { name: '清除' })).toBeNull()

  rerender(
    <FilterPanel title="属性筛选" collapsed={false} onToggle={() => {}} activeCount={2} onClear={onClear} clearLabel="清除">
      <div>内容</div>
    </FilterPanel>,
  )
  expect(screen.getByText('2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '清除' }))
  expect(onClear).toHaveBeenCalledTimes(1)
  void container
})

it('expands with the grid-rows animation when not collapsed', () => {
  const { container } = render(
    <FilterPanel title="属性筛选" collapsed={false} onToggle={() => {}}>
      <div>内容</div>
    </FilterPanel>,
  )
  const animated = container.querySelector('.grid.transition-all')
  expect(animated?.className).toContain('grid-rows-[1fr]')
  expect(animated?.className).toContain('opacity-100')
  const contentWrap = animated?.querySelector('.overflow-hidden')
  expect(contentWrap?.hasAttribute('inert')).toBe(false)
})

it('renders no clear button when onClear is set without a label', () => {
  const { container } = render(
    <FilterPanel title="属性筛选" collapsed={false} onToggle={() => {}} activeCount={2} onClear={() => {}}>
      <div>内容</div>
    </FilterPanel>,
  )
  expect(container.querySelector('button')).not.toBeNull()
  // 没有 clearLabel 时不得渲染空标签的清除按钮。
  expect([...container.querySelectorAll('button')].some((b) => b.textContent.trim() === '')).toBe(false)
})
