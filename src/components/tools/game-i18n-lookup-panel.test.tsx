// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GAME_I18N_LOCALES, type GameI18nManifest } from '@/lib/game-i18n-shared'

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
  areAllGameI18nLocalesLoaded: () => true,
  loadGameI18nManifest: async () => manifest,
  prefetchAllGameI18nLocales: async () => undefined,
  searchGameI18n: async (options: {
    onPartialHits?: (hits: Array<{ textId: string; texts: Record<string, string>; pendingLocales: [] }>) => void
    onSearchProgress?: (loaded: number, total: number, hits: number) => void
    onResolveProgress?: (done: number, total: number) => void
  }) => {
    const hits = [
      { textId: '10001', texts: { 'zh-CN': '第一条' }, pendingLocales: [] as [] },
      { textId: '10002', texts: { 'zh-CN': '第二条' }, pendingLocales: [] as [] },
    ]
    options.onSearchProgress?.(1234, 1234, hits.length)
    options.onPartialHits?.(hits)
    options.onResolveProgress?.(hits.length, hits.length)
    return hits
  },
}))

import { GameI18nLookupPanel } from './game-i18n-lookup-panel'

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

  const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
  secondRow?.dispatchEvent(spaceEvent)
  expect(spaceEvent.defaultPrevented).toBe(true)
  await waitFor(() => expect(secondRow?.getAttribute('aria-selected')).toBe('true'))
})
