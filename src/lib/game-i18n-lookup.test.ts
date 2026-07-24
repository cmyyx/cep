import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  areAllGameI18nLocalesLoaded,
  clearGameI18nLookupCache,
  isGameI18nLocaleLoaded,
  prefetchAllGameI18nLocales,
  prefetchGameI18nLocale,
  searchGameI18n,
} from './game-i18n-lookup'
import { GAME_I18N_LOCALES, type GameI18nLocale, type GameI18nManifest } from './game-i18n-shared'

const PRIMARY_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const satisfies readonly GameI18nLocale[]

function localeChunks(locale: GameI18nLocale) {
  return [
    { file: `${locale}/000.json`, count: 2, startId: '10001', endId: '10002', bytes: 40 },
    { file: `${locale}/001.json`, count: 1, startId: '20001', endId: '20001', bytes: 20 },
  ]
}

const sampleText: Record<(typeof PRIMARY_LOCALES)[number], Record<string, string>> = {
  'zh-CN': {
    '10001': '终末地基质规划',
    '10002': '精锻方案',
    '20001': '基质优化',
  },
  en: {
    '10001': 'Endfield matrix planning',
    '10002': 'Refinement plan',
    '20001': 'Matrix optimization',
  },
  ja: {
    '10001': '終末地マトリクス計画',
    '10002': '精錬プラン',
    '20001': 'マトリクス最適化',
  },
  'zh-TW': {
    '10001': '終末地基質規劃',
    '10002': '精鍛方案',
    '20001': '基質優化',
  },
}

const manifest: GameI18nManifest = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  maxChunkBytes: 1024,
  locales: Object.fromEntries(
    GAME_I18N_LOCALES.map((locale) => [
      locale,
      {
        entryCount: 3,
        chunks: localeChunks(locale),
      },
    ]),
  ) as GameI18nManifest['locales'],
}

const chunks: Record<string, Record<string, string>> = {}
for (const locale of GAME_I18N_LOCALES) {
  const texts =
    locale in sampleText
      ? sampleText[locale as (typeof PRIMARY_LOCALES)[number]]
      : {
          '10001': `${locale}-matrix`,
          '10002': `${locale}-refine`,
          '20001': `${locale}-optimize`,
        }
  chunks[`${locale}/000.json`] = {
    '10001': texts['10001'],
    '10002': texts['10002'],
  }
  chunks[`${locale}/001.json`] = {
    '20001': texts['20001'],
  }
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response
}

beforeEach(() => {
  clearGameI18nLookupCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/game-i18n/manifest.json')) return jsonResponse(manifest)
      const marker = '/game-i18n/'
      const index = url.indexOf(marker)
      const file = index >= 0 ? url.slice(index + marker.length) : url
      const body = chunks[file]
      if (!body) {
        return { ok: false, status: 404, json: async () => ({}) } as Response
      }
      return jsonResponse(body)
    }),
  )
})

afterEach(() => {
  clearGameI18nLookupCache()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('prefetches search-locale chunks in parallel and reports byte progress', async () => {
  const progress: Array<{ loadedChunks: number; loadedBytes: number; totalBytes: number }> = []
  await prefetchGameI18nLocale('zh-CN', {
    onProgress: (p) => {
      progress.push({
        loadedChunks: p.loadedChunks,
        loadedBytes: p.loadedBytes,
        totalBytes: p.totalBytes,
      })
    },
  })

  expect(isGameI18nLocaleLoaded('zh-CN')).toBe(true)
  expect(progress.at(-1)).toEqual({ loadedChunks: 2, loadedBytes: 60, totalBytes: 60 })
  expect(progress.some((p) => p.loadedChunks === 1)).toBe(true)

  const fetchMock = vi.mocked(fetch)
  const chunkCalls = fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/zh-CN/'))
  expect(chunkCalls).toHaveLength(2)
})

it('prefetches all locales with aggregate progress', async () => {
  const ticks: Array<{ loadedLocales: number; totalLocales: number }> = []
  await prefetchAllGameI18nLocales({
    concurrency: 4,
    onProgress: (p) => {
      ticks.push({ loadedLocales: p.loadedLocales, totalLocales: p.totalLocales })
    },
  })

  expect(areAllGameI18nLocalesLoaded()).toBe(true)
  expect(ticks.at(-1)).toEqual({ loadedLocales: GAME_I18N_LOCALES.length, totalLocales: GAME_I18N_LOCALES.length })
  expect(ticks.some((t) => t.loadedLocales > 0 && t.loadedLocales < GAME_I18N_LOCALES.length)).toBe(true)
})

it('streams partial hits with pending locales before multilingual resolve finishes', async () => {
  const partialSnapshots: Array<Array<{ textId: string; pending?: string[]; hasEn: boolean }>> = []
  const resolveTicks: Array<{ done: number; total: number }> = []
  const searchTicks: Array<{ loaded: number; total: number; hits: number }> = []

  const results = await searchGameI18n({
    searchLocale: 'zh-CN',
    query: '基质',
    limit: 10,
    displayLocales: [...PRIMARY_LOCALES],
    onSearchProgress: (loaded, total, hits) => {
      searchTicks.push({ loaded, total, hits })
    },
    onPartialHits: (hits) => {
      partialSnapshots.push(
        hits.map((hit) => ({
          textId: hit.textId,
          pending: hit.pendingLocales,
          hasEn: hit.texts.en !== undefined,
        })),
      )
    },
    onResolveProgress: (done, total) => {
      resolveTicks.push({ done, total })
    },
  })

  expect(results.map((hit) => hit.textId).sort()).toEqual(['10001', '20001'])
  expect(results.every((hit) => hit.texts.en && hit.texts.ja && hit.texts['zh-TW'])).toBe(true)
  expect(results.every((hit) => (hit.pendingLocales?.length ?? 0) === 0)).toBe(true)

  // Progress is entry-based (map size), not chunk-based.
  expect(searchTicks[0]?.total).toBe(3)
  expect(searchTicks.some((tick) => tick.loaded === 0)).toBe(true)
  expect(searchTicks.at(-1)?.hits).toBe(2)

  // First streamed snapshot should appear as soon as the first hit is found.
  const firstPartialWithHits = partialSnapshots.find((snap) => snap.length > 0)
  expect(firstPartialWithHits).toBeTruthy()
  expect(firstPartialWithHits?.length).toBeGreaterThanOrEqual(1)
  expect(firstPartialWithHits?.every((hit) => (hit.pending?.length ?? 0) > 0)).toBe(true)
  expect(firstPartialWithHits?.every((hit) => !hit.hasEn)).toBe(true)

  const lastPartial = partialSnapshots.at(-1)
  expect(lastPartial?.every((hit) => hit.hasEn && (hit.pending?.length ?? 0) === 0)).toBe(true)
  expect(resolveTicks[0]).toEqual({ done: 0, total: 2 })
  expect(resolveTicks.at(-1)).toEqual({ done: 2, total: 2 })
})

it('fills all locales from memory when fully prefetched', async () => {
  await prefetchAllGameI18nLocales({ concurrency: 8 })
  const resolveTicks: Array<{ done: number; total: number }> = []
  const partialLengths: number[] = []
  const results = await searchGameI18n({
    searchLocale: 'zh-CN',
    query: '基质',
    limit: 10,
    onPartialHits: (hits) => partialLengths.push(hits.length),
    onResolveProgress: (done, total) => resolveTicks.push({ done, total }),
  })
  expect(results).toHaveLength(2)
  expect(results.every((hit) => GAME_I18N_LOCALES.every((locale) => hit.texts[locale]))).toBe(true)
  // Streaming: at least one partial before/at finalization.
  expect(partialLengths.some((n) => n > 0)).toBe(true)
  // Fully warm path finalizes in one resolve tick (done === total).
  expect(resolveTicks.at(-1)).toEqual({ done: 2, total: 2 })
})

it('supports textId lookup and aborts cleanly', async () => {
  const hits = await searchGameI18n({
    searchLocale: 'zh-CN',
    query: '10002',
    displayLocales: [...PRIMARY_LOCALES],
  })
  expect(hits).toHaveLength(1)
  expect(hits[0]?.texts['zh-CN']).toBe('精锻方案')
  expect(hits[0]?.texts.en).toBe('Refinement plan')

  const controller = new AbortController()
  controller.abort()
  await expect(
    searchGameI18n({
      searchLocale: 'en',
      query: 'matrix',
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ name: 'AbortError' })
})

it('exposes all upstream locales in GAME_I18N_LOCALES', () => {
  expect(GAME_I18N_LOCALES).toEqual([
    'zh-CN',
    'en',
    'ja',
    'zh-TW',
    'ko',
    'de',
    'fr',
    'it',
    'ru',
    'pt-BR',
    'es-MX',
    'id',
    'th',
    'vi',
  ])
})
