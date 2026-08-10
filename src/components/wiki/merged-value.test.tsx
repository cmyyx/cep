// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MergedValue } from './merged-value'

afterEach(cleanup)

it('renders the value with the base cell classes', () => {
  const { container } = render(<MergedValue value="20" span={1} />)
  const span = container.querySelector('span')
  expect(span?.textContent).toBe('20')
  expect(span?.className).toContain('inline-flex min-h-10 items-center px-2 py-2')
  expect(span?.className).not.toContain('sticky')
})

it('pins merged values below the sticky header via the header-height variable when span > 1', () => {
  const { container } = render(<MergedValue value="160" span={12} />)
  const span = container.querySelector('span')
  expect(span?.className).toContain('sticky top-[var(--table-header-h,2.5rem)]')
})
