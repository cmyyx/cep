#!/usr/bin/env node
/**
 * CLI: export chunked game I18nTextTable files to public/game-i18n/
 *
 *   pnpm game-i18n:export
 *   pnpm game-i18n:export --akedata D:/GitHub/AKEData
 *   pnpm game-i18n:export --max-chunk-bytes 10485760
 */
import { join } from 'node:path'
import {
  DEFAULT_MAX_CHUNK_BYTES,
  exportGameI18nTables,
  parseMaxChunkBytesArg,
  resolveAkedataPath,
} from './lib/export-game-i18n'

const projectRoot = process.cwd()
const args = process.argv.slice(2)

const akedataPath = resolveAkedataPath({ args, projectRoot })
const outputDir = join(projectRoot, 'public', 'game-i18n')
const maxChunk = parseMaxChunkBytesArg(
  (() => {
    const index = args.indexOf('--max-chunk-bytes')
    return index < 0 ? undefined : args[index + 1]
  })(),
  DEFAULT_MAX_CHUNK_BYTES,
)

console.log(`Exporting game I18nTextTable from ${akedataPath}`)
console.log(`Output: ${outputDir}`)
console.log(`Max chunk bytes: ${maxChunk}`)

const result = exportGameI18nTables(akedataPath, outputDir, maxChunk)
for (const locale of Object.keys(result.manifest.locales)) {
  const meta = result.manifest.locales[locale as keyof typeof result.manifest.locales]
  console.log(
    `  ${locale}: ${meta.entryCount} entries, ${meta.chunks.length} chunks, max ${Math.max(...meta.chunks.map((c) => c.bytes))} bytes`,
  )
}
console.log(`Wrote ${result.files.length} files.`)
