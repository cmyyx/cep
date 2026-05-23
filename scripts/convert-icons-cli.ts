#!/usr/bin/env node
// Standalone icon conversion CLI.
// Converts weapon/equip PNG icons from AKEDatabase to AVIF for the project.
// ================================================================================

import { resolvePaths } from './lib/upstream'
import { convertIcons } from './lib/convert-icons'
import { resolve } from 'node:path'

function parseArgs() {
  const a = process.argv.slice(2)
  return {
    paths: Object.fromEntries(['akedata','translation','imagedb'].map((k) => {
      const idx = a.indexOf('--' + k); return [k, idx >= 0 ? a[idx+1] ?? '' : '']
    })),
  }
}

async function main() {
  const { paths: cliPaths } = parseArgs()
  const paths = resolvePaths(cliPaths)

  if (!paths.imagedb) {
    console.error('  Error: --imagedb path is required for icon conversion\n')
    process.exit(1)
  }

  const projectRoot = resolve(import.meta.dirname ?? __dirname, '..')
  const publicDir = resolve(projectRoot, 'public')

  console.log(`\n[sync:icons] Converting icons...`)
  console.log(`  Source: ${paths.imagedb}`)
  console.log(`  Target: ${publicDir}`)

  const result = await convertIcons(paths.imagedb, publicDir, ['weapon', 'equip'])

  console.log(`  Converted: ${result.converted.length}`)
  console.log(`  Skipped: ${result.skipped.length}`)
  if (result.missingSource.length > 0) {
    console.log(`  Missing source: ${result.missingSource.length}`)
  }
  console.log('\n  Done\n')
}

main().catch(err => { console.error(err); process.exit(1) })
