/**
 * Export AKEData I18nTextTable_* into chunked static files under public/game-i18n/.
 *
 * Only game client text tables are copied (not site messages / wikiData).
 * Keys are textId strings; values are locale strings.
 *
 * Chunking keeps each file under maxChunkBytes so hosts with per-file limits
 * (often ~10–25MB) do not reject deploy artifacts as tables grow.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  compareTextId,
  GAME_I18N_LOCALES,
  type GameI18nChunkMeta,
  type GameI18nLocale,
  type GameI18nLocaleMeta,
  type GameI18nManifest,
} from '../../src/lib/game-i18n-shared'

export {
  compareTextId,
  findChunkIndexForTextId,
  GAME_I18N_LOCALES,
  type GameI18nChunkMeta,
  type GameI18nLocale,
  type GameI18nLocaleMeta,
  type GameI18nManifest,
} from '../../src/lib/game-i18n-shared'

/** Upstream TableCfg filename suffix per project locale. */
const UPSTREAM_SUFFIX: Record<GameI18nLocale, string> = {
  'zh-CN': 'CN',
  en: 'EN',
  ja: 'JP',
  'zh-TW': 'TC',
}

/** Default max serialized JSON size per chunk (~8MiB, under common 10–20MB host limits). */
export const DEFAULT_MAX_CHUNK_BYTES = 8 * 1024 * 1024

/** Pack sorted [id, text] pairs into size-capped objects. */
export function packGameI18nChunks(
  entries: Array<readonly [string, string]>,
  maxChunkBytes: number,
): Array<{ map: Record<string, string>; bytes: number; startId: string; endId: string; count: number }> {
  if (maxChunkBytes < 1024) throw new Error('maxChunkBytes too small')
  const chunks: Array<{ map: Record<string, string>; bytes: number; startId: string; endId: string; count: number }> = []
  let current: Record<string, string> = {}
  let currentCount = 0
  let currentBytes = 2
  let startId = ''
  let endId = ''

  const entryBytes = (id: string, text: string) =>
    Buffer.byteLength(id, 'utf8') + Buffer.byteLength(text, 'utf8') + 6

  const flush = () => {
    if (currentCount === 0) return
    const serialized = JSON.stringify(current)
    chunks.push({
      map: current,
      bytes: Buffer.byteLength(serialized, 'utf8'),
      startId,
      endId,
      count: currentCount,
    })
    current = {}
    currentCount = 0
    currentBytes = 2
    startId = ''
    endId = ''
  }

  for (const [id, text] of entries) {
    const cost = entryBytes(id, text)
    const nextBytes = currentBytes + cost + (currentCount > 0 ? 1 : 0)
    if (currentCount > 0 && nextBytes > maxChunkBytes) flush()
    if (currentCount === 0) startId = id
    current[id] = text
    endId = id
    currentCount += 1
    currentBytes += cost + (currentCount > 1 ? 1 : 0)
  }
  flush()
  return chunks
}

export function loadUpstreamI18nTable(akedataPath: string, locale: GameI18nLocale): Record<string, string> {
  const path = join(akedataPath, 'TableCfg', `I18nTextTable_${UPSTREAM_SUFFIX[locale]}.json`)
  if (!existsSync(path)) throw new Error(`Missing upstream table: ${path}`)
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  const table: Record<string, string> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'string') table[id] = value
  }
  return table
}

export interface ExportGameI18nResult {
  outputDir: string
  manifest: GameI18nManifest
  files: string[]
}

export function exportGameI18nTables(
  akedataPath: string,
  outputDir: string,
  maxChunkBytes = DEFAULT_MAX_CHUNK_BYTES,
): ExportGameI18nResult {
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }
  mkdirSync(outputDir, { recursive: true })

  const locales = {} as Record<GameI18nLocale, GameI18nLocaleMeta>
  const files: string[] = []

  for (const locale of GAME_I18N_LOCALES) {
    const table = loadUpstreamI18nTable(akedataPath, locale)
    const sorted = Object.entries(table).sort(([a], [b]) => compareTextId(a, b))
    const packed = packGameI18nChunks(sorted, maxChunkBytes)
    const localeDir = join(outputDir, locale)
    mkdirSync(localeDir, { recursive: true })

    const chunks: GameI18nChunkMeta[] = packed.map((chunk, index) => {
      const file = `${locale}/${String(index).padStart(3, '0')}.json`
      const abs = join(outputDir, file)
      writeFileSync(abs, JSON.stringify(chunk.map), 'utf8')
      files.push(abs)
      return {
        file,
        count: chunk.count,
        startId: chunk.startId,
        endId: chunk.endId,
        bytes: chunk.bytes,
      }
    })

    locales[locale] = {
      entryCount: sorted.length,
      chunks,
    }
  }

  const manifest: GameI18nManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    maxChunkBytes,
    locales,
  }
  const manifestPath = join(outputDir, 'manifest.json')
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  files.push(manifestPath)

  return { outputDir, manifest, files }
}
