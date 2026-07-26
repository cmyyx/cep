// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const { DataLoadError } = await import('./data-load-error')

afterEach(cleanup)

it('announces the failure with its own common copy and calls onRetry', () => {
  const onRetry = vi.fn()
  render(<DataLoadError onRetry={onRetry} />)

  expect(screen.getByRole('alert')).toBeTruthy()
  // Copy is owned by the component (common.*), not passed in by the route — the
  // planner pages used to hand it unrelated strings (gameI18nLookup / auth / backgroundPreview).
  expect(screen.getByText('common.dataLoadFailed')).toBeTruthy()
  expect(screen.getByText('common.dataLoadFailedHint')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
  expect(onRetry).toHaveBeenCalledOnce()
})

it('renders the headline and the hint as separate paragraphs', () => {
  render(<DataLoadError onRetry={() => undefined} />)

  expect(screen.getByRole('alert').querySelectorAll('p')).toHaveLength(2)
})
