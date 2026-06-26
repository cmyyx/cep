#!/usr/bin/env -S npx tsx
// One-shot migration: replace CN stat names in weapons.ts / dungeons.ts with gemTermId.
// Builds mapping from upstream GemTable → TextTable CN, with explicit overrides
// for the 2 weapon skillNames that diverge from GemTable naming.
// ================================================================================

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStatMapping } from './lib/stat-mapping'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const config = JSON.parse(readFileSync(join(projectRoot, 'sync-game-data.config.json'), 'utf-8'))
const mapping = buildStatMapping(config.akedataPath)

// ── Migration helpers ────────────────────────────────────────────────────

function replaceAll(str: string): string {
  // Sort keys longest-first to avoid partial replacements
  const keys = Object.keys(mapping.exact).sort((a, b) => b.length - a.length)
  let result = str
  for (const cn of keys) {
    const escaped = cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`'${escaped}'`, 'g'), `'${mapping.resolve(cn)}'`)
  }
  return result
}

function migrateFile(relativePath: string) {
  const filePath = join(projectRoot, relativePath)
  const original = readFileSync(filePath, 'utf-8')
  const migrated = replaceAll(original)

  if (migrated === original) {
    console.log(`  ${relativePath}: no changes`)
    return
  }

  // Count changes
  const originalMatches = original.match(/'([^']+)'/g) ?? []
  const migratedMatches = migrated.match(/'([^']+)'/g) ?? []
  let changed = 0
  for (let i = 0; i < originalMatches.length; i++) {
    if (originalMatches[i] !== migratedMatches[i]) changed++
  }

  writeFileSync(filePath, migrated, 'utf-8')
  console.log(`  ${relativePath}: ${changed} replacements`)
}

// ── Run ──────────────────────────────────────────────────────────────────

console.log('GemTable entries:', Object.keys(mapping.exact).length)
console.log()

console.log('Migrating data files:')
migrateFile('src/data/weapons.ts')
migrateFile('src/data/dungeons.ts')

console.log('\nDone.')
