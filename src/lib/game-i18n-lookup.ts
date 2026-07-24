/**
 * Client-side loader / search for chunked game I18nTextTable exports
 * under /game-i18n/ (public). Only used by the game-i18n tool page.
 */
import {
  findChunkIndexForTextId,
  GAME_I18N_LOCALES,
  type GameI18nLocale,
  type GameI18nManifest,
} from '@/lib/game-i18n-shared'

export type { GameI18nLocale, GameI18nManifest }

const BASE = '/game-i18n'
const RESOLVE_CONCURRENCY = 6
const PREFETCH_LOCALE_CONCURRENCY = 3

let manifestPromise: Promise<GameI18nManifest> | null = null
const chunkCache = new Map<string, Promise<Record<string, string>>>()
const localeMaps = new Map<GameI18nLocale, Map<string, string>>()
const localeFullyLoaded = new Set<GameI18nLocale>()
const localePrefetchPromises = new Map<GameI18nLocale, Promise<void>>()

export function clearGameI18nLookupCache(): void {
  manifestPromise = null
  chunkCache.clear()
  localeMaps.clear()
  localeFullyLoaded.clear()
  localePrefetchPromises.clear()
}

export async function loadGameI18nManifest(): Promise<GameI18nManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${BASE}/manifest.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load game-i18n manifest (${response.status})`)
        return (await response.json()) as GameI18nManifest
      })
      .catch((error: unknown) => {
        manifestPromise = null
        throw error
      })
  }
  return manifestPromise
}

async function loadChunk(file: string): Promise<Record<string, string>> {
  let pending = chunkCache.get(file)
  if (!pending) {
    pending = fetch(`${BASE}/${file}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load ${file} (${response.status})`)
        return (await response.json()) as Record<string, string>
      })
      .catch((error: unknown) => {
        chunkCache.delete(file)
        throw error
      })
    chunkCache.set(file, pending)
  }
  return pending
}

function ensureLocaleMap(locale: GameI18nLocale): Map<string, string> {
  let map = localeMaps.get(locale)
  if (!map) {
    map = new Map()
    localeMaps.set(locale, map)
  }
  return map
}

export function isGameI18nLocaleLoaded(locale: GameI18nLocale): boolean {
  return localeFullyLoaded.has(locale)
}

export function areAllGameI18nLocalesLoaded(): boolean {
  return GAME_I18N_LOCALES.every((locale) => localeFullyLoaded.has(locale))
}

export interface GameI18nLoadProgress {
  locale: GameI18nLocale
  loadedChunks: number
  totalChunks: number
  loadedBytes: number
  totalBytes: number
}

export interface GameI18nAllLoadProgress {
  loadedLocales: number
  totalLocales: number
  loadedBytes: number
  totalBytes: number
  /** Locales that finished loading so far. */
  readyLocales: GameI18nLocale[]
  /** Locale that most recently reported chunk progress (for status text). */
  activeLocale: GameI18nLocale | null
}

export interface GameI18nSearchHit {
  textId: string
  texts: Partial<Record<GameI18nLocale, string>>
  /** Locales still being resolved for this hit (empty when complete). */
  pendingLocales?: GameI18nLocale[]
}

export interface GameI18nSearchOptions {
  searchLocale: GameI18nLocale
  query: string
  limit?: number
  displayLocales?: GameI18nLocale[]
  signal?: AbortSignal
  onLocaleLoadProgress?: (progress: GameI18nLoadProgress) => void
  onAllLocalesLoadProgress?: (progress: GameI18nAllLoadProgress) => void
  /** scannedEntries / totalEntries while scanning the search-locale map in memory. */
  onSearchProgress?: (scannedEntries: number, totalEntries: number, hits: number) => void
  onPartialHits?: (hits: GameI18nSearchHit[]) => void
  onResolveProgress?: (resolved: number, total: number) => void
}

function isTextIdQuery(query: string): boolean {
  return /^-?\d{5,}$/.test(query.trim())
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

function cloneHits(hits: GameI18nSearchHit[]): GameI18nSearchHit[] {
  return hits.map((hit) => ({
    textId: hit.textId,
    texts: { ...hit.texts },
    pendingLocales: hit.pendingLocales ? [...hit.pendingLocales] : undefined,
  }))
}

function emitPartialHits(options: GameI18nSearchOptions, hits: GameI18nSearchHit[]): void {
  options.onPartialHits?.(cloneHits(hits))
}

async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (items.length === 0) return
  let next = 0
  const run = async () => {
    while (next < items.length) {
      assertNotAborted(signal)
      const index = next
      next += 1
      await worker(items[index], index)
    }
  }
  const agents = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(agents)
}

/**
 * Prefetch every chunk for a locale into the in-memory map.
 * Safe to call repeatedly; fully-loaded locales resolve immediately.
 * Downloads chunks in parallel. Page-scoped only (call from the tool panel).
 */
export async function prefetchGameI18nLocale(
  locale: GameI18nLocale,
  options?: {
    signal?: AbortSignal
    onProgress?: (progress: GameI18nLoadProgress) => void
  },
): Promise<void> {
  const reportComplete = async () => {
    if (!options?.onProgress) return
    const manifest = await loadGameI18nManifest()
    const meta = manifest.locales[locale]
    if (!meta) return
    const totalChunks = meta.chunks.length
    const totalBytes = meta.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0)
    options.onProgress({
      locale,
      loadedChunks: totalChunks,
      totalChunks,
      loadedBytes: totalBytes,
      totalBytes,
    })
  }

  if (localeFullyLoaded.has(locale)) {
    await reportComplete()
    assertNotAborted(options?.signal)
    return
  }

  const existing = localePrefetchPromises.get(locale)
  if (existing) {
    await existing
    assertNotAborted(options?.signal)
    await reportComplete()
    return
  }

  const run = (async () => {
    const manifest = await loadGameI18nManifest()
    const meta = manifest.locales[locale]
    if (!meta) throw new Error(`Unknown locale: ${locale}`)

    const totalChunks = meta.chunks.length
    const totalBytes = meta.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0)

    if (localeFullyLoaded.has(locale) || totalChunks === 0) {
      localeFullyLoaded.add(locale)
      options?.onProgress?.({
        locale,
        loadedChunks: totalChunks,
        totalChunks,
        loadedBytes: totalBytes,
        totalBytes,
      })
      return
    }

    const map = ensureLocaleMap(locale)
    const completed = new Set<string>()

    const report = () => {
      let loadedBytes = 0
      for (const chunk of meta.chunks) {
        if (completed.has(chunk.file)) loadedBytes += chunk.bytes
      }
      options?.onProgress?.({
        locale,
        loadedChunks: completed.size,
        totalChunks,
        loadedBytes,
        totalBytes,
      })
    }

    await Promise.all(
      meta.chunks.map(async (chunk) => {
        assertNotAborted(options?.signal)
        const data = await loadChunk(chunk.file)
        assertNotAborted(options?.signal)
        for (const [id, text] of Object.entries(data)) map.set(id, text)
        completed.add(chunk.file)
        report()
      }),
    )

    assertNotAborted(options?.signal)
    localeFullyLoaded.add(locale)
  })()

  const tracked = run.catch((error: unknown) => {
    localePrefetchPromises.delete(locale)
    throw error
  })
  localePrefetchPromises.set(locale, tracked)

  await tracked
}

/**
 * Prefetch every supported locale (limited concurrency). Used when entering the tool page.
 */
export async function prefetchAllGameI18nLocales(options?: {
  signal?: AbortSignal
  concurrency?: number
  onProgress?: (progress: GameI18nAllLoadProgress) => void
}): Promise<void> {
  const manifest = await loadGameI18nManifest()
  const concurrency = options?.concurrency ?? PREFETCH_LOCALE_CONCURRENCY
  const totalLocales = GAME_I18N_LOCALES.length
  const totalBytes = GAME_I18N_LOCALES.reduce((sum, locale) => {
    const meta = manifest.locales[locale]
    if (!meta) return sum
    return sum + meta.chunks.reduce((inner, chunk) => inner + chunk.bytes, 0)
  }, 0)

  const localeBytes = new Map<GameI18nLocale, { loaded: number; total: number; ready: boolean }>()
  for (const locale of GAME_I18N_LOCALES) {
    const meta = manifest.locales[locale]
    const total = meta?.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0) ?? 0
    const ready = localeFullyLoaded.has(locale)
    localeBytes.set(locale, {
      loaded: ready ? total : 0,
      total,
      ready,
    })
  }

  let activeLocale: GameI18nLocale | null = null

  const report = () => {
    let loadedBytes = 0
    let loadedLocales = 0
    const readyLocales: GameI18nLocale[] = []
    for (const locale of GAME_I18N_LOCALES) {
      const state = localeBytes.get(locale)
      if (!state) continue
      loadedBytes += state.loaded
      if (state.ready) {
        loadedLocales += 1
        readyLocales.push(locale)
      }
    }
    options?.onProgress?.({
      loadedLocales,
      totalLocales,
      loadedBytes,
      totalBytes,
      readyLocales,
      activeLocale,
    })
  }

  report()
  if (areAllGameI18nLocalesLoaded()) return

  await mapPool(
    GAME_I18N_LOCALES,
    concurrency,
    async (locale) => {
      assertNotAborted(options?.signal)
      activeLocale = locale
      await prefetchGameI18nLocale(locale, {
        signal: options?.signal,
        onProgress: (progress) => {
          const state = localeBytes.get(locale)
          if (!state) return
          state.loaded = progress.loadedBytes
          state.total = progress.totalBytes
          state.ready = progress.loadedChunks >= progress.totalChunks && progress.totalChunks > 0
          activeLocale = locale
          report()
        },
      })
      const state = localeBytes.get(locale)
      if (state) {
        state.loaded = state.total
        state.ready = true
      }
      report()
    },
    options?.signal,
  )

  assertNotAborted(options?.signal)
  activeLocale = null
  report()
}

/**
 * Progressive keyword / textId search.
 * Prefetches the search locale first (if needed), streams partial hits with the
 * search-locale text, then fills other display locales (from memory or on-demand).
 */
export async function searchGameI18n(options: GameI18nSearchOptions): Promise<GameI18nSearchHit[]> {
  const query = options.query.trim()
  if (!query) return []
  const limit = options.limit ?? 100
  const displayLocales = options.displayLocales ?? [...GAME_I18N_LOCALES]
  const manifest = await loadGameI18nManifest()
  const searchMeta = manifest.locales[options.searchLocale]
  if (!searchMeta) throw new Error(`Unknown locale: ${options.searchLocale}`)

  await prefetchGameI18nLocale(options.searchLocale, {
    signal: options.signal,
    onProgress: options.onLocaleLoadProgress,
  })
  assertNotAborted(options.signal)

  // Page-level prefetch already warms all locales. Report aggregate readiness only;
  // do not start a second background full-table load during search (avoids races).
  if (areAllGameI18nLocalesLoaded()) {
    options.onAllLocalesLoadProgress?.({
      loadedLocales: GAME_I18N_LOCALES.length,
      totalLocales: GAME_I18N_LOCALES.length,
      loadedBytes: 1,
      totalBytes: 1,
      readyLocales: [...GAME_I18N_LOCALES],
      activeLocale: null,
    })
  }

  const map = ensureLocaleMap(options.searchLocale)
  const totalEntries = map.size
  const pendingOther = displayLocales.filter((locale) => locale !== options.searchLocale)
  const allDisplayReady = displayLocales.every(
    (locale) => locale === options.searchLocale || localeFullyLoaded.has(locale),
  )

  let hits: GameI18nSearchHit[] = []

  if (isTextIdQuery(query)) {
    const textId = query.trim()
    const text = map.get(textId)
    if (text === undefined) {
      options.onSearchProgress?.(totalEntries, totalEntries, 0)
      emitPartialHits(options, [])
      return []
    }
    hits = [
      {
        textId,
        texts: { [options.searchLocale]: text },
        pendingLocales: allDisplayReady ? [] : pendingOther.length > 0 ? [...pendingOther] : [],
      },
    ]
    options.onSearchProgress?.(totalEntries, totalEntries, 1)
    if (allDisplayReady) {
      hits = hits.map((hit) => fillHitFromLoadedLocales(hit, displayLocales))
    }
    emitPartialHits(options, hits)
  } else {
    const needle = query.toLocaleLowerCase()
    // Yield + progress so UI can show real scan progress (entries, not chunks).
    // Stream partial hits so the result table grows while scanning.
    let scanned = 0
    let lastEmittedHits = 0
    options.onSearchProgress?.(0, totalEntries, 0)
    for (const [textId, text] of map) {
      assertNotAborted(options.signal)
      scanned += 1
      if (text.toLocaleLowerCase().includes(needle)) {
        hits.push({
          textId,
          texts: { [options.searchLocale]: text },
          pendingLocales: allDisplayReady ? [] : pendingOther.length > 0 ? [...pendingOther] : [],
        })
        // Emit as soon as the first hit lands, then every few hits.
        if (hits.length === 1 || hits.length - lastEmittedHits >= 3) {
          lastEmittedHits = hits.length
          if (allDisplayReady) {
            emitPartialHits(
              options,
              hits.map((hit) => fillHitFromLoadedLocales(hit, displayLocales)),
            )
          } else {
            emitPartialHits(options, hits)
          }
        }
        if (hits.length >= limit) break
      }
      if (scanned % 4000 === 0 || scanned === totalEntries || hits.length >= limit) {
        options.onSearchProgress?.(scanned, totalEntries, hits.length)
        if (hits.length > lastEmittedHits) {
          lastEmittedHits = hits.length
          if (allDisplayReady) {
            emitPartialHits(
              options,
              hits.map((hit) => fillHitFromLoadedLocales(hit, displayLocales)),
            )
          } else {
            emitPartialHits(options, hits)
          }
        }
        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
          else setTimeout(resolve, 0)
        })
      }
    }
    options.onSearchProgress?.(scanned, totalEntries, hits.length)
    if (allDisplayReady && hits.length > 0) {
      hits = hits.map((hit) => fillHitFromLoadedLocales(hit, displayLocales))
    }
    emitPartialHits(options, hits)
  }

  if (hits.length === 0) return []

  if (pendingOther.length === 0 || allDisplayReady) {
    const finalized = hits.map((hit) => fillHitFromLoadedLocales(hit, displayLocales))
    emitPartialHits(options, finalized)
    options.onResolveProgress?.(finalized.length, finalized.length)
    return finalized
  }

  // Entering multilingual fill phase — report 0/N immediately so UI is never blank.
  options.onResolveProgress?.(0, hits.length)

  let resolvedCount = 0
  await mapPool(
    hits,
    RESOLVE_CONCURRENCY,
    async (hit, index) => {
      assertNotAborted(options.signal)
      const full = await resolveHit(hit.textId, displayLocales, manifest, options.signal)
      if (full) {
        hits[index] = {
          textId: full.textId,
          texts: full.texts,
          pendingLocales: [],
        }
      } else {
        hits[index] = {
          textId: hit.textId,
          texts: { ...hit.texts },
          pendingLocales: [],
        }
      }
      resolvedCount += 1
      options.onResolveProgress?.(resolvedCount, hits.length)
      emitPartialHits(options, hits)
    },
    options.signal,
  )

  return hits.map((hit) => ({
    textId: hit.textId,
    texts: { ...hit.texts },
    pendingLocales: [],
  }))
}

function fillHitFromLoadedLocales(hit: GameI18nSearchHit, locales: GameI18nLocale[]): GameI18nSearchHit {
  const texts: Partial<Record<GameI18nLocale, string>> = { ...hit.texts }
  for (const locale of locales) {
    if (texts[locale] !== undefined) continue
    const map = localeMaps.get(locale)
    if (!map) continue
    if (map.has(hit.textId)) texts[locale] = map.get(hit.textId)
  }
  return { textId: hit.textId, texts, pendingLocales: [] }
}

async function resolveHit(
  textId: string,
  locales: GameI18nLocale[],
  manifest: GameI18nManifest,
  signal?: AbortSignal,
): Promise<GameI18nSearchHit | null> {
  const texts: Partial<Record<GameI18nLocale, string>> = {}

  await Promise.all(
    locales.map(async (locale) => {
      assertNotAborted(signal)
      const map = ensureLocaleMap(locale)
      if (map.has(textId)) {
        texts[locale] = map.get(textId)
        return
      }
      const meta = manifest.locales[locale]
      if (!meta) return
      const index = findChunkIndexForTextId(meta.chunks, textId)
      if (index < 0) return
      const data = await loadChunk(meta.chunks[index].file)
      assertNotAborted(signal)
      for (const [id, text] of Object.entries(data)) map.set(id, text)
      if (map.has(textId)) texts[locale] = map.get(textId)
    }),
  )

  if (Object.keys(texts).length === 0) return null
  return { textId, texts, pendingLocales: [] }
}
