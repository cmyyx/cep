// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { LocaleGuardHead } from './locale-guard-head'

it('sets the document language from the URL before redirect checks', () => {
  const { container } = render(<LocaleGuardHead />)
  const code = container.querySelector('script')?.textContent ?? ''

  expect(code).toContain('document.documentElement.lang')
  expect(code.indexOf('document.documentElement.lang')).toBeLessThan(
    code.indexOf('localStorage.getItem')
  )
})
