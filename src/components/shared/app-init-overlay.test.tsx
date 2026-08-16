// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AppInitOverlay } from './app-init-overlay'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/shared/guard-layout', () => ({
  FEEDBACK_CHANNELS: { github: { href: '' }, forum: { href: '' }, qqGroup: { href: '' } },
  GuardFeedback: () => null,
}))

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.cepHydrated
})

it('sets the hydration sentinel for the inline JS-resource guard on mount', () => {
  expect(document.documentElement.getAttribute('data-cep-hydrated')).toBeNull()
  render(<AppInitOverlay />)
  expect(document.documentElement.getAttribute('data-cep-hydrated')).toBe('1')
})
