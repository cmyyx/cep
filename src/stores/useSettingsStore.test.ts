// @vitest-environment jsdom

import { beforeEach, expect, it } from 'vitest'
import { useSettingsStore } from './useSettingsStore'

/** The store boots from hardcoded defaults, so this is the sanitizer's fallback. */
const DEFAULT_BG = useSettingsStore.getState().backgroundUrl

function persistBackgroundUrl(value: unknown) {
  localStorage.setItem('cep-settings', JSON.stringify({ backgroundUrl: value }))
}

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ backgroundUrl: DEFAULT_BG })
})

it('keeps a persisted absolute http(s) background and trims it', () => {
  persistBackgroundUrl('  https://example.com/bg.png  ')
  useSettingsStore.getState().hydrateFromStorage()
  expect(useSettingsStore.getState().backgroundUrl).toBe('https://example.com/bg.png')
})

// Regression: these values reached <Image src> unchecked because isValidBackgroundUrl
// only guarded the settings form, not already-persisted / imported state.
it.each([
  'javascript:alert(1)',
  'data:image/png;base64,AAAA',
  'ftp://example.com/bg.png',
  '/background.jpg',
  'example.com/bg.png',
  '',
  '   ',
])('falls back to the default background for illegal persisted value "%s"', (value) => {
  persistBackgroundUrl(value)
  useSettingsStore.getState().hydrateFromStorage()
  expect(useSettingsStore.getState().backgroundUrl).toBe(DEFAULT_BG)
})

it('falls back when the persisted background is not a string', () => {
  for (const value of [42, null, { url: 'https://example.com/bg.png' }]) {
    useSettingsStore.setState({ backgroundUrl: DEFAULT_BG })
    persistBackgroundUrl(value)
    useSettingsStore.getState().hydrateFromStorage()
    expect(useSettingsStore.getState().backgroundUrl).toBe(DEFAULT_BG)
  }
})

it('sanitizes on read only, leaving the persisted payload untouched', () => {
  persistBackgroundUrl('javascript:alert(1)')
  const before = localStorage.getItem('cep-settings')
  useSettingsStore.getState().hydrateFromStorage()
  expect(localStorage.getItem('cep-settings')).toBe(before)
})
