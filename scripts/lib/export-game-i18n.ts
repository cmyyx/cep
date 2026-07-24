/**
 * Export AKEData I18nTextTable_* into chunked static files under public/game-i18n/.
 *
 * Only game client text tables are copied (not site messages / wikiData).
 * Keys are textId strings; values are locale strings.
 *
 * Chunking keeps each file under maxChunkBytes so hosts with per-file limits
 * (often ~10–25MB) do not reject deploy artifacts as tables grow.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

export function assertSafeMaxChunkBytes(maxChunkBytes: number): number {
  if (!Number.isSafeInteger(maxChunkBytes) || maxChunkBytes < 1024) {
    throw new Error(`maxChunkBytes must be a safe integer >= 1024 (got ${String(maxChunkBytes)})`)
  }
  return maxChunkBytes
}

/** Parse CLI --max-chunk-bytes; empty/undefined uses fallback. */
export function parseMaxChunkBytesArg(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return assertSafeMaxChunkBytes(fallback)
  const value = Number(raw)
  return assertSafeMaxChunkBytes(value)
}

export function argValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index < 0) return undefined
  return args[index + 1]
}

export function resolveAkedataPath(options: {
  args: string[]
  projectRoot: string
  existsSync?: typeof existsSync
  readFileSync?: typeof readFileSync
}): string {
  const exists = options.existsSync ?? existsSync
  const read = options.readFileSync ?? readFileSync
  const fromCli = argValue(options.args, '--akedata')
  if (fromCli) return fromCli
  const configPath = join(options.projectRoot, 'sync-game-data.config.json')
  if (exists(configPath)) {
    const config = JSON.parse(read(configPath, 'utf8')) as { akedataPath?: string }
    if (config.akedataPath) return config.akedataPath
  }
  throw new Error('akedataPath required (sync-game-data.config.json or --akedata)')
}

/** UTF-8 size of one JSON object entry: "id":"text" plus optional leading comma. */
export function entrySerializedBytes(id: string, text: string, withLeadingComma: boolean): number {
  return (
    Buffer.byteLength(JSON.stringify(id), 'utf8') +
    1 + // :
    Buffer.byteLength(JSON.stringify(text), 'utf8') +
    (withLeadingComma ? 1 : 0)
  )
}

/** Pack sorted [id, text] pairs into size-capped objects. */
export function packGameI18nChunks(
  entries: Array<readonly [string, string]>,
  maxChunkBytes: number,
): Array<{ map: Record<string, string>; bytes: number; startId: string; endId: string; count: number }> {
  assertSafeMaxChunkBytes(maxChunkBytes)
  const chunks: Array<{ map: Record<string, string>; bytes: number; startId: string; endId: string; count: number }> = []
  let current: Record<string, string> = {}
  let currentCount = 0
  let currentBytes = 2 // {}
  let startId = ''
  let endId = ''

  const flush = () => {
    if (currentCount === 0) return
    const serialized = JSON.stringify(current)
    const bytes = Buffer.byteLength(serialized, 'utf8')
    if (bytes > maxChunkBytes) {
      throw new Error(`chunk exceeded maxChunkBytes (${bytes} > ${maxChunkBytes})`)
    }
    chunks.push({
      map: current,
      bytes,
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
    const soleBytes = 2 + entrySerializedBytes(id, text, false)
    if (soleBytes > maxChunkBytes) {
      throw new Error(
        `single entry exceeds maxChunkBytes (${soleBytes} > ${maxChunkBytes}) for textId ${id}`,
      )
    }
    let leadingComma = currentCount > 0
    let cost = entrySerializedBytes(id, text, leadingComma)
    if (currentCount > 0 && currentBytes + cost > maxChunkBytes) {
      flush()
      leadingComma = false
      cost = entrySerializedBytes(id, text, false)
    }
    if (currentCount === 0) startId = id
    current[id] = text
    endId = id
    currentCount += 1
    currentBytes += cost
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
  const budget = assertSafeMaxChunkBytes(maxChunkBytes)

  // Load + pack all locales first so missing upstream never wipes the previous export.
  const packedByLocale = {} as Record<
    GameI18nLocale,
    {
      entryCount: number
      packed: ReturnType<typeof packGameI18nChunks>
    }
  >
  for (const locale of GAME_I18N_LOCALES) {
    const table = loadUpstreamI18nTable(akedataPath, locale)
    const sorted = Object.entries(table).sort(([a], [b]) => compareTextId(a, b))
    packedByLocale[locale] = {
      entryCount: sorted.length,
      packed: packGameI18nChunks(sorted, budget),
    }
  }

  const parent = dirname(outputDir)
  mkdirSync(parent, { recursive: true })
  const tempDir = join(parent, `.game-i18n-tmp-${process.pid}-${Date.now()}`)
  mkdirSync(tempDir, { recursive: true })

  const locales = {} as Record<GameI18nLocale, GameI18nLocaleMeta>
  const files: string[] = []

  try {
    for (const locale of GAME_I18N_LOCALES) {
      const { entryCount, packed } = packedByLocale[locale]
      const localeDir = join(tempDir, locale)
      mkdirSync(localeDir, { recursive: true })

      const chunks: GameI18nChunkMeta[] = packed.map((chunk, index) => {
        const file = `${locale}/${String(index).padStart(3, '0')}.json`
        const abs = join(tempDir, file)
        writeFileSync(abs, JSON.stringify(chunk.map), 'utf8')
        files.push(join(outputDir, file))
        return {
          file,
          count: chunk.count,
          startId: chunk.startId,
          endId: chunk.endId,
          bytes: chunk.bytes,
        }
      })

      locales[locale] = { entryCount, chunks }
    }

    const manifest: GameI18nManifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      maxChunkBytes: budget,
      locales,
    }
    const manifestPath = join(tempDir, 'manifest.json')
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    files.push(join(outputDir, 'manifest.json'))

    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true })
    }
    renameSync(tempDir, outputDir)

    return { outputDir, manifest, files }
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })
    throw error
  }
}
