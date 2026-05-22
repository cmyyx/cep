#!/usr/bin/env node
import { resolvePaths, getRepoHead, validatePaths } from './lib/upstream'
import { generateWeaponI18n } from './lib/generate-weapons'
import { generateEquipI18n } from './lib/generate-equips'
import { generateDungeonI18n } from './lib/generate-dungeons'
import { generateMetadataI18n } from './lib/generate-metadata'
import { compareWeapons } from './lib/compare-weapons'
import { readStoredSha, fetchTrackingBranch, updateTrackingBranch, branchExistsOnOrigin } from './lib/git-helpers'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

function parseArgs() {
  const a = process.argv.slice(2)
  return {
    mode: (a.includes('--update') ? 'update' : 'check') as 'check' | 'update',
    local: a.includes('--local'),
    iconsOnly: a.includes('--icons-only'),
    paths: Object.fromEntries(['akedata','translation','imagedb'].map((k,i) => {
      const idx = a.indexOf('--' + k); return [k, idx >= 0 ? a[idx+1] ?? '' : '']
    })),
  }
}

async function main() {
  const { mode, local, iconsOnly, paths: cliPaths } = parseArgs()
  console.log(`\n[sync] mode=${mode} local=${local} iconsOnly=${iconsOnly}`)
  const paths = resolvePaths(cliPaths)
  console.log(`  AKEData: ${paths.akedata}\n  AKEDatabase: ${paths.imagedb}\n  Translation: ${paths.translation}`)
  const warnings = validatePaths(paths)
  if (warnings.length > 0) {
    console.warn('\n  Warnings:')
    warnings.forEach(w => console.warn(`    ${w}`))
    if (!local) { console.error('  Exiting.\n'); process.exit(1) }
  }

  // SHA check (skip for local mode or icons-only)
  if (!local && !iconsOnly) {
    fetchTrackingBranch()
    const stored = branchExistsOnOrigin('auto/upstream-tracking') ? readStoredSha('.akadata-sha') : null
    const current = getRepoHead(paths.akedata)
    if (stored && current === stored) { console.log('\n  Up to date.\n'); process.exit(0) }
    if (mode === 'check') { process.exit(2) }
  }

  const projectRoot = resolve(join(import.meta.dirname ?? __dirname, '..'))
  const generatedRoot = join(projectRoot, 'src', 'generated', 'i18n')
  mkdirSync(generatedRoot, { recursive: true })

  // Weapons (AKEDatabase/public/CH as primary source)
  console.log('\n-- Weapons --')
  const charWpnRecPath = join(paths.akedata, 'TableCfg', 'CharWpnRecommendTable.json')
  const charWpnRec = existsSync(charWpnRecPath)
    ? JSON.parse(readFileSync(charWpnRecPath, 'utf-8')) as Record<string, unknown>
    : {}
  const wpnResult = compareWeapons(paths.akedata, join(projectRoot, 'src', 'data', 'weapons.ts'), {}, charWpnRec)
  console.log(`  Total: ${wpnResult.entries.length} | New >=4star: ${wpnResult.entries.filter(w=>w.isNew&&w.rarity>=4).length}`)
  for (const w of wpnResult.entries) {
    if (w.isNew && w.rarity >= 4) console.log(`  NEW  ${w.weaponId}: ${w.title} (${w.rarity}star, ${w.typeName})`)
  }
  if (mode === 'update') {
    const r = generateWeaponI18n(paths.akedata, paths.imagedb, paths.translation, generatedRoot)
    console.log(`  i18n: ${r.written.length} files, ${r.count} wpns, ${r.missing} missing`)
  }

  // Equips (AKEDatabase/public/CH as primary source)
  console.log('\n-- Equips (>=5star) --')
  if (mode === 'update') {
    const r = generateEquipI18n(paths.akedata, paths.imagedb, paths.translation, generatedRoot)
    console.log(`  i18n: ${r.written.length} files, ${r.count} entries, ${r.missing} missing`)
  }

  // Dungeons (Energy Alluvium) - generates dungeons + regions + stats i18n
  console.log('\n-- Dungeons (Energy Alluvium) --')
  if (mode === 'update') {
    const r = generateDungeonI18n(paths.akedata, paths.translation, generatedRoot)
    console.log(`  Dungeon i18n: ${r.dungeonWritten.length} files, ${r.dungeonCount} dungeons`)
    console.log(`  Region i18n: ${r.regionWritten.length} files, ${r.regionCount} regions`)
    console.log(`  Stat i18n: ${r.statsWritten.length} files, ${r.statCount} gem terms, ${r.missing} missing`)
  }

  // Metadata: equip types, materials (with abbreviation->full mapping), suit names
  console.log('\n-- Metadata --')
  if (mode === 'update') {
    const m = generateMetadataI18n(paths.translation, generatedRoot, paths.imagedb, paths.akedata)
    console.log(`  i18n: ${m.files} files, ${m.terms} terms`)
  }

  // SHA update
  if (mode === 'update' && !local) {
    console.log('\n-- Updating SHA --')
    updateTrackingBranch({ akedata: getRepoHead(paths.akedata), translation: getRepoHead(paths.translation) })
  }

  console.log('\n  Done\n')
}

main().catch(err => { console.error(err); process.exit(1) })
