#!/usr/bin/env node
import { resolvePaths, getRepoHead, validatePaths } from './lib/upstream'
import { generateWeaponI18n } from './lib/generate-weapons'
import { generateWeaponStatsI18n } from './lib/generate-weapon-stats-i18n'
import { generateEquipI18n } from './lib/generate-equips'
import { generateDungeonI18n } from './lib/generate-dungeons'
import { generateMetadataI18n } from './lib/generate-metadata'
import { generateStatI18n } from './lib/generate-stat-i18n'
import { generateCharacterI18n } from './lib/generate-characters'
import { generateWikiData } from './lib/generate-wiki-data'
import { compareWeapons } from './lib/compare-weapons'
import { compareEquips } from './lib/compare-equips'
import { compareDungeons } from './lib/compare-dungeons'
import { updateWeaponsFile, updateEquipsFile, updateDungeonsFile, reconcileWeaponsIconIds } from './lib/update-data-files'
import { validateAllData, validateImages } from './lib/validate-data'
import { convertWikiAssets } from './lib/convert-icons'
import { downloadCharacterAvatars } from './lib/download-character-avatars'
import type { WikiAssets } from './lib/wiki-assets'
import { readUpstreamVersions, upstreamVersionsMatch, writeUpstreamVersions } from './lib/git-helpers'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { extractItemNameIds } from './lib/extract-textid'
import { loadTextTable } from './lib/stat-mapping'

/** Build weapon name → weaponId mapping from TableCfg (WeaponBasicTable + ItemTable + I18nTextTable_CN). */
function buildWeaponNameMap(akedataPath: string): Map<string, string> {
  const nameMap = new Map<string, string>()

  // Load WeaponBasicTable for weapon list
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  if (!existsSync(wpnBasicPath)) return nameMap
  const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, unknown>

  // Load ItemTable name text IDs
  const weaponTextIds = extractItemNameIds(join(akedataPath, 'TableCfg', 'ItemTable.json'))

  // Load CN TextTable for display names
  const cnTextTable = loadTextTable(akedataPath, 'zh-CN')

  for (const weaponId of Object.keys(wpnBasic)) {
    const nameTextId = weaponTextIds[weaponId]
    const title = nameTextId ? (cnTextTable[nameTextId] ?? weaponId) : weaponId
    if (title) nameMap.set(title, weaponId)
  }

  return nameMap
}

/** Detect and optionally update preview weapons in weapons.ts */
function updatePreviewWeapons(
  weaponsTsPath: string,
  nameMap: Map<string, string>,
  updateMode: boolean,
): { previewCount: number; updatable: { name: string; previewId: string; formalId: string }[]; updated: number } {
  if (!existsSync(weaponsTsPath)) return { previewCount: 0, updatable: [], updated: 0 }
  const content = readFileSync(weaponsTsPath, 'utf-8')
  // Match preview weapons: { id: 'preview:XXX', ... source: 'preview' }
  const previewRe = /\{\s*id:\s*'(preview:[^']+)'[^}]*?name:\s*'([^']+)'[^}]*?source:\s*'preview'[^}]*?\}/g
  const updatable: { name: string; previewId: string; formalId: string }[] = []
  let previewCount = 0
  let m: RegExpExecArray | null
  while ((m = previewRe.exec(content)) !== null) {
    previewCount++
    const previewId = m[1]
    const name = m[2]
    const formalId = nameMap.get(name)
    if (formalId) {
      updatable.push({ name, previewId, formalId })
    }
  }
  if (updateMode && updatable.length > 0) {
    let updatedContent = content
    for (const { previewId, formalId } of updatable) {
      // Replace id: 'preview:XXX' with id: 'wpn_xxx'
      updatedContent = updatedContent.replace(
        new RegExp(`id:\\s*'${previewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'),
        `id: '${formalId}'`,
      )
    }
    // Remove source: 'preview' from updated weapons
    for (const { formalId } of updatable) {
      // Match the line containing id: 'wpn_xxx' and remove source: 'preview'
      const escapedFormalId = formalId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const lineRe = new RegExp(`(id:\\s*'${escapedFormalId}'[^}]*?)source:\\s*'preview',?\\s*`, 'g')
      updatedContent = updatedContent.replace(lineRe, '$1')
    }
    writeFileSync(weaponsTsPath, updatedContent, 'utf-8')
    return { previewCount, updatable, updated: updatable.length }
  }
  return { previewCount, updatable, updated: 0 }
}

function parseArgs() {
  const a = process.argv.slice(2)
  return {
    mode: (a.includes('--update') ? 'update' : 'check') as 'check' | 'update',
    local: a.includes('--local'),
    iconsOnly: a.includes('--icons-only'),
    paths: Object.fromEntries(['akedata','imagedb'].map((k) => {
      const idx = a.indexOf('--' + k); return [k, idx >= 0 ? a[idx+1] ?? '' : '']
    })),
  }
}

async function main() {
  const { mode, local, iconsOnly, paths: cliPaths } = parseArgs()
  console.log(`\n[sync] mode=${mode} local=${local} iconsOnly=${iconsOnly}`)
  const paths = resolvePaths(cliPaths)
  console.log(`  AKEData: ${paths.akedata}\n  AKEDatabase: ${paths.imagedb}`)
  const warnings = validatePaths(paths)
  if (warnings.length > 0) {
    console.warn('\n  Warnings:')
    warnings.forEach(w => console.warn(`    ${w}`))
    if (!local) { console.error('  Exiting.\n'); process.exit(1) }
  }

  // SHA check (skip for local mode or icons-only)
  if (!local && !iconsOnly) {
    const versions = readUpstreamVersions()
    const currentAkedata = getRepoHead(paths.akedata)
    const currentImagedb = getRepoHead(paths.imagedb)
    if (upstreamVersionsMatch(versions, {
      akedata: currentAkedata,
      imagedb: currentImagedb,
    })) {
      // SHA matches, but still verify image integrity — a previous sync may
      // have committed data without generating the corresponding images
      // (e.g. sparse-checkout was missing the image source directory).
      const projectRoot = resolve(join(import.meta.dirname ?? __dirname, '..'))
      const missingImages = validateImages(projectRoot)
      if (missingImages.length === 0) {
        console.log('\n  Up to date.\n')
        process.exit(0)
      }
      console.log(`\n  SHA matches but ${missingImages.length} image(s) missing — re-sync needed:`)
      for (const img of missingImages) console.log(`    ${img}`)
      if (mode === 'check') { process.exit(2) }
      // update mode: fall through to full sync
    }
    if (mode === 'check') { process.exit(2) }
  }

  const projectRoot = resolve(join(import.meta.dirname ?? __dirname, '..'))
  const generatedRoot = join(projectRoot, 'src', 'generated', 'i18n')
  mkdirSync(generatedRoot, { recursive: true })

  // Weapons (AKEData as source)
  console.log('\n-- Weapons --')
  const charWpnRecPath = join(paths.akedata, 'TableCfg', 'CharWpnRecommendTable.json')
  const charWpnRec = existsSync(charWpnRecPath)
    ? JSON.parse(readFileSync(charWpnRecPath, 'utf-8')) as Record<string, unknown>
    : {}
  const wpnResult = compareWeapons(paths.akedata, join(projectRoot, 'src', 'data', 'weapons.ts'), charWpnRec)
  console.log(`  Total: ${wpnResult.entries.length} | New >=4star: ${wpnResult.entries.filter(w=>w.isNew&&w.rarity>=4).length}`)
  for (const w of wpnResult.entries) {
    if (w.isNew && w.rarity >= 4) console.log(`  NEW  ${w.weaponId}: ${w.title} (${w.rarity}star, ${w.typeName})`)
  }

  // iconId consistency check (both check and update modes run this; check mode just reports)
  const weaponsTsPath = join(projectRoot, 'src', 'data', 'weapons.ts')
  const iconIdReconcile = reconcileWeaponsIconIds(weaponsTsPath, paths.akedata, true)
  if (iconIdReconcile.issues.length > 0) {
    console.log(`  iconId issues: ${iconIdReconcile.issues.length} (added=${iconIdReconcile.issues.filter(i=>i.type==='missing').length}, mismatch=${iconIdReconcile.issues.filter(i=>i.type==='mismatch').length})`)
    for (const issue of iconIdReconcile.issues) {
      const tag = issue.type === 'missing' ? 'MISSING' : 'MISMATCH'
      const actual = issue.actual || '<none>'
      console.log(`    [${tag}] ${issue.weaponId}: expected "${issue.expected}", got "${actual}"`)
    }
    if (mode === 'check') {
      console.error('  iconId reconciliation required. Run sync:update to fix.')
      process.exit(2)
    }
  } else if (iconIdReconcile.unchanged > 0) {
    console.log(`  iconId: ${iconIdReconcile.unchanged} verified, ${iconIdReconcile.skipped} skipped (no upstream entry)`)
  }
  // Preview weapon detection and update
  const weaponNameMap = buildWeaponNameMap(paths.akedata)
  const previewResult = updatePreviewWeapons(weaponsTsPath, weaponNameMap, mode === 'update')
  if (previewResult.previewCount > 0) {
    console.log(`\n  Preview weapons: ${previewResult.previewCount} total, ${previewResult.updatable.length} updatable`)
    for (const p of previewResult.updatable) {
      console.log(`    ${p.previewId} -> ${p.formalId} (${p.name})`)
    }
    if (previewResult.updated > 0) {
      console.log(`  Updated: ${previewResult.updated} preview weapons -> 正式 IDs`)
    }
  }
  if (mode === 'update') {
    const promotedFormalIds = new Set(previewResult.updatable.map(p => p.formalId))
    const newWeaponIds = wpnResult.entries
      .filter(w => w.isNew && w.rarity >= 4 && !promotedFormalIds.has(w.weaponId))
      .map(w => w.weaponId)
    if (newWeaponIds.length > 0) {
      const updated = updateWeaponsFile(weaponsTsPath, newWeaponIds, paths.akedata)
      console.log(`  Updated: ${updated} weapons added to weapons.ts`)
    }
    const iconIdFix = reconcileWeaponsIconIds(weaponsTsPath, paths.akedata, false)
    if (iconIdFix.added > 0 || iconIdFix.updated > 0) {
      console.log(`  iconId reconciled: ${iconIdFix.added} added, ${iconIdFix.updated} updated, ${iconIdFix.unchanged} unchanged`)
    }
    const wI18n = generateWeaponI18n(paths.akedata, generatedRoot)
    console.log(`  i18n: ${wI18n.written.length} files, ${wI18n.count} wpns, ${wI18n.missing} missing`)
    const ws = generateWeaponStatsI18n(paths.akedata, generatedRoot)
    console.log(`  weaponStats: ${ws.written.length} files, ${ws.count} entries, ${ws.missing} missing`)
  }

  // Equips (AKEData as source)
  console.log('\n-- Equips (>=5star) --')
  const equipResult = compareEquips(paths.akedata, join(projectRoot, 'src', 'data', 'equips.ts'))
  console.log(`  Total: ${equipResult.entries.length} | New: ${equipResult.newCount}`)
  for (const e of equipResult.entries) {
    if (e.isNew) console.log(`  NEW  ${e.equipId}: ${e.name} (${e.rarity}star, ${e.slot})`)
  }
  if (mode === 'update') {
    const newEquipIds = equipResult.entries.filter(e => e.isNew).map(e => e.equipId)
    const equipsTsPath = join(projectRoot, 'src', 'data', 'equips.ts')
    const updated = updateEquipsFile(equipsTsPath, newEquipIds, paths.akedata, true)
    console.log(`  Reconciled: ${updated} equips synced`)
    const eI18n = generateEquipI18n(paths.akedata, generatedRoot)
    console.log(`  i18n: ${eI18n.written.length} files, ${eI18n.count} entries, ${eI18n.missing} missing`)
  }

  // Dungeons (Energy Alluvium) - generates dungeons + regions + stats i18n
  console.log('\n-- Dungeons (Energy Alluvium) --')
  const dungeonResult = compareDungeons(paths.akedata, join(projectRoot, 'src', 'data', 'dungeons.ts'))
  console.log(`  Total: ${dungeonResult.entries.length} | New: ${dungeonResult.newCount}`)
  for (const d of dungeonResult.entries) {
    if (d.isNew) console.log(`  NEW  ${d.dungeonId}`)
  }
  if (mode === 'update') {
    // Update dungeons.ts with new dungeons
    const newDungeonIds = dungeonResult.entries.filter(d => d.isNew).map(d => d.dungeonId)
    if (newDungeonIds.length > 0) {
      const dungeonsTsPath = join(projectRoot, 'src', 'data', 'dungeons.ts')
      const updated = updateDungeonsFile(dungeonsTsPath, newDungeonIds, paths.akedata)
      console.log(`  Updated: ${updated} dungeons added to dungeons.ts`)
    }
    const r = generateDungeonI18n(paths.akedata, generatedRoot)
    console.log(`  Dungeon i18n: ${r.dungeonWritten.length} files, ${r.dungeonCount} dungeons`)
    console.log(`  Region i18n: ${r.regionWritten.length} files, ${r.regionCount} regions`)
  }

  // Metadata: equip types, materials (with abbreviation->full mapping), suit names
  console.log('\n-- Metadata --')
  if (mode === 'update') {
    const m = generateMetadataI18n(paths.akedata, generatedRoot)
    console.log(`  i18n: ${m.files} files, ${m.terms} terms`)
  }

  // Wiki data: characters + consolidated wiki entity arrays
  console.log('\n-- Wiki data --')
  if (mode === 'update') {
    const dataOutputDir = join(projectRoot, 'src', 'generated', 'data')
    const ch = generateCharacterI18n(paths.akedata, paths.imagedb, generatedRoot, dataOutputDir)
    console.log(`  Characters: ${ch.written.length} files, ${ch.count} chars, ${ch.missing} missing`)
    if (ch.dataWritten) console.log(`  Data: ${ch.dataWritten}`)

    const wk = generateWikiData(paths.akedata, paths.imagedb, generatedRoot, dataOutputDir, ch.wikiData)
    for (const cat of wk.categories) {
      console.log(`  ${cat}: ${wk.counts[cat]} entities`)
    }
  }

  // Generate stat i18n — gemStats (weapons/dungeons) + equipStats (equipment)
  if (mode === 'update') {
    console.log('\n-- Stat i18n --')
    const r = generateStatI18n(paths.akedata, generatedRoot)
    console.log(`  gemStats: ${r.gemWritten.length} files, ${r.gemCount} gem terms`)
    console.log(`  equipStats: ${r.equipWritten.length} files, ${r.equipCount} equip terms`)
    if (r.equipUnmatched.length > 0) {
      console.log(`  Equip-specific attrs (using attrType key):`)
      for (const u of r.equipUnmatched) console.log(`    ${u}`)
    }
    console.log(`  Missing translations: ${r.missing}`)
  }

  // Validate existing data against upstream
  console.log('\n-- Validation --')
  const validationIssues = validateAllData(paths.akedata, projectRoot)
  if (validationIssues.length > 0) {
    console.log(`  Found ${validationIssues.length} data inconsistency:`)
    for (const issue of validationIssues) {
      console.log(`  [${issue.category}] ${issue.id}.${issue.field}: expected "${issue.expected}", got "${issue.actual}"`)
    }
  } else {
    console.log(`  All data consistent with upstream`)
  }

  // Generate every image declared by the Wiki asset manifest before validation.
  if (mode === 'update') {
    console.log('\n-- Image generation --')
    const assets = JSON.parse(
      readFileSync(join(projectRoot, 'src', 'generated', 'data', 'wiki', 'assets.json'), 'utf8')
    ) as WikiAssets
    const characterResult = await downloadCharacterAvatars(
      join(projectRoot, 'public')
    )
    console.log(
      `  Characters: ${characterResult.avatars} avatars, ${characterResult.fullBody} full-body`
    )
    const iconResult = await convertWikiAssets(join(projectRoot, 'public'), assets)
    console.log(
      `  Icons: ${iconResult.converted.length} converted, ${iconResult.skipped.length} unchanged`
    )
    if (iconResult.missingSource.length > 0) {
      throw new Error(
        `Missing ${iconResult.missingSource.length} upstream Wiki image(s):\n${iconResult.missingSource.join('\n')}`
      )
    }
  }

  // Validate image existence — block on missing images to prevent broken PRs
  console.log('\n-- Image validation --')
  const missingImages = validateImages(projectRoot)
  if (missingImages.length > 0) {
    console.error(`\n  ERROR: ${missingImages.length} missing image(s):`)
    for (const img of missingImages) {
      console.error(`    ${img}`)
    }
    console.error('\n  Images are required for build. Aborting to prevent broken deployment.')
    process.exit(1)
  } else {
    console.log(`  All images present`)
  }

  // SHA update — write version file to working tree (committed via PR)
  if (mode === 'update' && !local) {
    console.log('\n-- Updating upstream versions --')
    writeUpstreamVersions({
      akedata: getRepoHead(paths.akedata),
      imagedb: getRepoHead(paths.imagedb),
    })
  }

  console.log('\n  Done\n')
}

main().catch(err => { console.error(err); process.exit(1) })
