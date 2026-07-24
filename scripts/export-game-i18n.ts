#!/usr/bin/env node
/**
 * CLI: export chunked game I18nTextTable files to public/game-i18n/
 *
 *   pnpm game-i18n:export
 *   pnpm game-i18n:export --akedata D:/GitHub/AKEData
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { exportGameI18nTables, DEFAULT_MAX_CHUNK_BYTES } from './lib/export-game-i18n'

const projectRoot = process.cwd()
const args = process.argv.slice(2)

function argValue(flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index < 0) return undefined
  return args[index + 1]
}

function resolveAkedataPath(): string {
  const fromCli = argValue('--akedata')
  if (fromCli) return fromCli
  const configPath = join(projectRoot, 'sync-game-data.config.json')
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { akedataPath?: string }
    if (config.akedataPath) return config.akedataPath
  }
  throw new Error('akedataPath required (sync-game-data.config.json or --akedata)')
}

const akedataPath = resolveAkedataPath()
const outputDir = join(projectRoot, 'public', 'game-i18n')
const maxChunk = Number(argValue('--max-chunk-bytes') ?? DEFAULT_MAX_CHUNK_BYTES)

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
