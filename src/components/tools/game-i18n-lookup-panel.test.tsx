// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GAME_I18N_LOCALES, type GameI18nLocale, type GameI18nManifest } from '@/lib/game-i18n-shared'

type PrefetchResult = {
  readyLocales: GameI18nLocale[]
  failedLocales: GameI18nLocale[]
}

type PrefetchOptions = {
  onProgress?: (progress: {
    loadedLocales: number
    totalLocales: number
    loadedBytes: number
    totalBytes: number
    readyLocales: GameI18nLocale[]
    failedLocales: GameI18nLocale[]
    activeLocale: GameI18nLocale | null
  }) => void
}

type SearchOptions = {
  onPartialHits?: (hits: Array<{ textId: string; texts: Record<string, string>; pendingLocales: [] }>) => void
  onSearchProgress?: (loaded: number, total: number, hits: number) => void
  onResolveProgress?: (done: number, total: number) => void
}

const lookupMocks = vi.hoisted(() => ({
  allLoaded: true,
  loadManifest: vi.fn<() => Promise<GameI18nManifest>>(),
  prefetch: vi.fn<(options?: PrefetchOptions) => Promise<PrefetchResult>>(),
  search: vi.fn<(options: SearchOptions) => Promise<Array<{ textId: string; texts: Record<string, string>; pendingLocales: [] }>>>(),
}))

const manifest: GameI18nManifest = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  maxChunkBytes: 1024,
  locales: Object.fromEntries(
    GAME_I18N_LOCALES.map((locale) => [locale, { entryCount: 1234, chunks: [] }]),
  ) as unknown as GameI18nManifest['locales'],
}

vi.mock('next-intl', () => ({
  useFormatter: () => ({ number: (value: number) => `formatted-${value}` }),
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('@/lib/game-i18n-lookup', () => ({
  areAllGameI18nLocalesLoaded: () => lookupMocks.allLoaded,
  loadGameI18nManifest: () => lookupMocks.loadManifest(),
  prefetchAllGameI18nLocales: (options?: PrefetchOptions) => lookupMocks.prefetch(options),
  searchGameI18n: (options: SearchOptions) => lookupMocks.search(options),
}))

import { GameI18nLookupPanel } from './game-i18n-lookup-panel'

beforeEach(() => {
  lookupMocks.allLoaded = true
  lookupMocks.loadManifest.mockReset().mockResolvedValue(manifest)
  lookupMocks.prefetch.mockReset().mockResolvedValue({
    readyLocales: [...GAME_I18N_LOCALES],
    failedLocales: [],
  })
  lookupMocks.search.mockReset().mockImplementation(async (options) => {
    const hits = [
      { textId: '10001', texts: { 'zh-CN': '第一条' }, pendingLocales: [] as [] },
      { textId: '10002', texts: { 'zh-CN': '第二条' }, pendingLocales: [] as [] },
    ]
    options.onSearchProgress?.(1234, 1234, hits.length)
    options.onPartialHits?.(hits)
    options.onResolveProgress?.(hits.length, hits.length)
    return hits
  })
})

afterEach(() => cleanup())

it('formats counts and supports keyboard selection for result rows', async () => {
  render(<GameI18nLookupPanel />)

  await waitFor(() => expect(screen.getByText(/formatted-1234/)).toBeTruthy())
  fireEvent.change(screen.getByLabelText('query'), { target: { value: '测试' } })

  const secondText = await screen.findByText('第二条')
  const secondRow = secondText.closest('tr')
  expect(secondRow).not.toBeNull()
  expect(secondRow?.getAttribute('tabindex')).toBe('0')
  expect(secondRow?.getAttribute('role')).toBe('row')
  expect(secondRow?.getAttribute('aria-selected')).toBe('false')

  const notCanceled = fireEvent.keyDown(secondRow!, { key: ' ', bubbles: true, cancelable: true })
  expect(notCanceled).toBe(false)
  await waitFor(() => expect(secondRow?.getAttribute('aria-selected')).toBe('true'))
})

it('shows exhausted resource failures and reloads only after the user asks', async () => {
  lookupMocks.allLoaded = false
  lookupMocks.prefetch
    .mockResolvedValueOnce({
      readyLocales: GAME_I18N_LOCALES.filter((locale) => locale !== 'ja'),
      failedLocales: ['ja'],
    })
    .mockResolvedValueOnce({
      readyLocales: [...GAME_I18N_LOCALES],
      failedLocales: [],
    })

  render(<GameI18nLookupPanel />)

  expect(await screen.findByText('prefetchFailed')).toBeTruthy()
  expect(screen.getByText('failedLocales:{"locales":"localeJa"}')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'reloadResources' }))

  await waitFor(() => expect(lookupMocks.prefetch).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByText('prefetchFailed')).toBeNull())
  expect(screen.getByText('allLocalesReady')).toBeTruthy()
})
