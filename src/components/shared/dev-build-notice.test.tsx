// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DevBuildNotice } from './dev-build-notice'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { site?: string }) => {
    if (key === 'description') return `Official site: ${values?.site ?? ''}`
    if (key === 'title') return 'Development / preview version'
    return 'Open official site'
  },
}))

it('shows a persistent warning and links to the official site', () => {
  render(<DevBuildNotice siteUrl="https://end.canmoe.com" />)

  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.getByText('Development / preview version')).toBeTruthy()
  expect(screen.getByText('Official site: end.canmoe.com')).toBeTruthy()
  const officialLink = screen.getByRole('button', { name: 'Open official site' })
  expect(officialLink.getAttribute('href')).toBe('https://end.canmoe.com')
  expect(officialLink.getAttribute('target')).toBe('_blank')
})
