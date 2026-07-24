// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useGameI18nLocale } from './use-game-i18n-catalogs'
import type { GameI18nLocaleBundle } from '@/lib/game-i18n-catalogs'
import type { WikiLocale } from '@/types/wiki'

const enBundle = {
  characters: { a: 'A' },
  weapons: {},
  equips: {},
  equipStats: {},
  wikiData: { k: 'en' },
} as unknown as GameI18nLocaleBundle

const jaBundle = {
  characters: { a: 'ア' },
  weapons: {},
  equips: {},
  equipStats: {},
  wikiData: { k: 'ja' },
} as unknown as GameI18nLocaleBundle

const cache = new Map<string, GameI18nLocaleBundle>()
const loadGameI18nLocale = vi.fn(async (locale: string) => {
  const bundle = locale === 'ja' ? jaBundle : enBundle
  cache.set(locale, bundle)
  return bundle
})

vi.mock('@/lib/game-i18n-catalogs', () => ({
  getCachedGameI18nLocale: (locale: string) => cache.get(locale),
  loadGameI18nLocale: (locale: string) => loadGameI18nLocale(locale),
}))

afterEach(() => {
  cleanup()
  cache.clear()
  loadGameI18nLocale.mockClear()
})

it('returns null until load resolves, then the locale bundle', async () => {
  const { result } = renderHook(() => useGameI18nLocale('en'))
  expect(result.current).toBeNull()

  await waitFor(() => {
    expect(result.current?.wikiData.k).toBe('en')
  })
  expect(loadGameI18nLocale).toHaveBeenCalledWith('en')
})

it('does not surface a stale locale bundle after locale changes', async () => {
  let resolveEn!: (value: GameI18nLocaleBundle) => void
  loadGameI18nLocale.mockImplementationOnce(
    () =>
      new Promise<GameI18nLocaleBundle>((resolve) => {
        resolveEn = resolve
      }),
  )
  loadGameI18nLocale.mockImplementationOnce(async (locale: string) => {
    cache.set(locale, jaBundle)
    return jaBundle
  })

  const { result, rerender } = renderHook(
    ({ locale }: { locale: WikiLocale }) => useGameI18nLocale(locale),
    { initialProps: { locale: 'en' as WikiLocale } },
  )

  rerender({ locale: 'ja' })
  await waitFor(() => {
    expect(result.current?.wikiData.k).toBe('ja')
  })

  await act(async () => {
    resolveEn(enBundle)
    cache.set('en', enBundle)
  })

  // Still on ja — late en resolve must not replace the returned catalog.
  expect(result.current?.wikiData.k).toBe('ja')
})
