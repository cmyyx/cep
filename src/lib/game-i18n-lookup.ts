/**
 * Client-side loader / search for chunked game I18nTextTable exports
 * under /game-i18n/ (public). Only used by the game-i18n tool page.
 */
import {
  findChunkIndexForTextId,
  type GameI18nLocale,
  type GameI18nManifest,
} from '@/lib/game-i18n-shared'

export type { GameI18nLocale, GameI18nManifest }

const BASE = '/game-i18n'

let manifestPromise: Promise<GameI18nManifest> | null = null
const chunkCache = new Map<string, Promise<Record<string, string>>>()
const localeMaps = new Map<GameI18nLocale, Map<string, string>>()

export function clearGameI18nLookupCache(): void {
  manifestPromise = null
  chunkCache.clear()
  localeMaps.clear()
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

export interface GameI18nSearchHit {
  textId: string
  texts: Partial<Record<GameI18nLocale, string>>
}

export interface GameI18nSearchOptions {
  searchLocale: GameI18nLocale
  query: string
  limit?: number
  displayLocales?: GameI18nLocale[]
  signal?: AbortSignal
  onLoadProgress?: (loaded: number, total: number) => void
  onSearchProgress?: (scannedChunks: number, totalChunks: number, hits: number) => void
}

function isTextIdQuery(query: string): boolean {
  return /^-?\d{5,}$/.test(query.trim())
}

/**
 * Progressive keyword / textId search.
 * Loads the search locale chunk-by-chunk (UI-yielding), then resolves other
 * locales for hits via range-based chunk lookup.
 */
export async function searchGameI18n(options: GameI18nSearchOptions): Promise<GameI18nSearchHit[]> {
  const query = options.query.trim()
  if (!query) return []
  const limit = options.limit ?? 100
  const displayLocales = options.displayLocales ?? (['zh-CN', 'en', 'ja', 'zh-TW'] as GameI18nLocale[])
  const manifest = await loadGameI18nManifest()
  const searchMeta = manifest.locales[options.searchLocale]
  if (!searchMeta) throw new Error(`Unknown locale: ${options.searchLocale}`)

  if (isTextIdQuery(query)) {
    const textId = query.trim()
    const index = findChunkIndexForTextId(searchMeta.chunks, textId)
    if (index < 0) return []
    const chunk = await loadChunk(searchMeta.chunks[index].file)
    const map = ensureLocaleMap(options.searchLocale)
    for (const [id, text] of Object.entries(chunk)) map.set(id, text)
    if (!map.has(textId)) return []
    const hit = await resolveHit(textId, displayLocales, manifest, options.signal)
    return hit ? [hit] : []
  }

  const needle = query.toLocaleLowerCase()
  const hits: GameI18nSearchHit[] = []
  const map = ensureLocaleMap(options.searchLocale)
  const totalChunks = searchMeta.chunks.length

  for (let i = 0; i < totalChunks; i += 1) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const meta = searchMeta.chunks[i]
    const data = await loadChunk(meta.file)
    for (const [id, text] of Object.entries(data)) map.set(id, text)
    options.onLoadProgress?.(i + 1, totalChunks)

    for (const [textId, text] of Object.entries(data)) {
      if (text.toLocaleLowerCase().includes(needle)) {
        hits.push({ textId, texts: { [options.searchLocale]: text } })
        if (hits.length >= limit) break
      }
    }
    options.onSearchProgress?.(i + 1, totalChunks, hits.length)
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
      else setTimeout(resolve, 0)
    })
    if (hits.length >= limit) break
  }

  const resolved: GameI18nSearchHit[] = []
  for (const hit of hits) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const full = await resolveHit(hit.textId, displayLocales, manifest, options.signal)
    if (full) resolved.push(full)
  }
  return resolved
}

async function resolveHit(
  textId: string,
  locales: GameI18nLocale[],
  manifest: GameI18nManifest,
  signal?: AbortSignal,
): Promise<GameI18nSearchHit | null> {
  const texts: Partial<Record<GameI18nLocale, string>> = {}
  for (const locale of locales) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const map = ensureLocaleMap(locale)
    if (map.has(textId)) {
      texts[locale] = map.get(textId)
      continue
    }
    const meta = manifest.locales[locale]
    if (!meta) continue
    const index = findChunkIndexForTextId(meta.chunks, textId)
    if (index < 0) continue
    const data = await loadChunk(meta.chunks[index].file)
    for (const [id, text] of Object.entries(data)) map.set(id, text)
    if (map.has(textId)) texts[locale] = map.get(textId)
  }
  if (Object.keys(texts).length === 0) return null
  return { textId, texts }
}
