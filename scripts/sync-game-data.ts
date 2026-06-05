#!/usr/bin/env node
import { resolvePaths, getRepoHead, validatePaths } from './lib/upstream'
import { generateWeaponI18n } from './lib/generate-weapons'
import { generateWeaponStatsI18n } from './lib/generate-weapon-stats-i18n'
import { generateEquipI18n } from './lib/generate-equips'
import { generateDungeonI18n } from './lib/generate-dungeons'
import { generateMetadataI18n } from './lib/generate-metadata'
import { generateStatI18n } from './lib/generate-stat-i18n'
import { generateWeaponStatMapping } from './lib/generate-weapon-stat-mapping'
import { generateEquipStatMapping } from './lib/generate-equip-stat-mapping'
import { compareWeapons } from './lib/compare-weapons'
import { compareEquips } from './lib/compare-equips'
import { compareDungeons } from './lib/compare-dungeons'
import { updateWeaponsFile, updateEquipsFile, updateDungeonsFile } from './lib/update-data-files'
import { validateAllData, validateImages } from './lib/validate-data'
import { convertIcons } from './lib/convert-icons'
import { readStoredSha, fetchTrackingBranch, updateTrackingBranch, branchExistsOnOrigin } from './lib/git-helpers'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Build weapon name → weaponId mapping from AKEDatabase + AKEData */
function buildWeaponNameMap(imagedbPath: string, akedataPath: string): Map<string, string> {
  const nameMap = new Map<string, string>()
  // Primary: AKEDatabase/public/CH/weapon/
  const primaryDir = imagedbPath ? join(imagedbPath, 'public', 'CH', 'weapon') : null
  // Fallback: AKEData/output/CN/weapon/
  const fallbackDir = join(akedataPath, 'output', 'CN', 'weapon')
  const weaponDir = primaryDir && existsSync(primaryDir) ? primaryDir
    : existsSync(fallbackDir) ? fallbackDir
    : null
  if (!weaponDir) return nameMap
  for (const file of readdirSync(weaponDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const weaponId = file.replace('.json', '')
    try {
      const data = JSON.parse(readFileSync(join(weaponDir, file), 'utf-8'))
      const title: string = data.title ?? weaponId
      if (title) nameMap.set(title, weaponId)
    } catch { /* skip malformed files */ }
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
    paths: Object.fromEntries(['akedata','translation','imagedb'].map((k) => {
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
  const wpnResult = compareWeapons(paths.akedata, join(projectRoot, 'src', 'data', 'weapons.ts'), {}, charWpnRec, paths.imagedb)
  console.log(`  Total: ${wpnResult.entries.length} | New >=4star: ${wpnResult.entries.filter(w=>w.isNew&&w.rarity>=4).length}`)
  for (const w of wpnResult.entries) {
    if (w.isNew && w.rarity >= 4) console.log(`  NEW  ${w.weaponId}: ${w.title} (${w.rarity}star, ${w.typeName})`)
  }
  // Preview weapon detection and update
  const weaponsTsPath = join(projectRoot, 'src', 'data', 'weapons.ts')
  const weaponNameMap = buildWeaponNameMap(paths.imagedb, paths.akedata)
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
    // Update weapons.ts with new weapons
    const newWeaponIds = wpnResult.entries.filter(w => w.isNew && w.rarity >= 4).map(w => w.weaponId)
    if (newWeaponIds.length > 0) {
      const updated = updateWeaponsFile(weaponsTsPath, newWeaponIds, paths.imagedb, paths.akedata, paths.translation)
      console.log(`  Updated: ${updated} weapons added to weapons.ts`)
    }
    const r = generateWeaponI18n(paths.akedata, paths.imagedb, paths.translation, generatedRoot)
    console.log(`  i18n: ${r.written.length} files, ${r.count} wpns, ${r.missing} missing`)
    const ws = generateWeaponStatsI18n(paths.imagedb, paths.akedata, paths.translation, generatedRoot)
    console.log(`  weaponStats: ${ws.written.length} files, ${ws.count} entries, ${ws.missing} missing`)
    const sm = generateWeaponStatMapping(paths.imagedb, paths.akedata, paths.translation, join(projectRoot, 'src', 'generated'))
    console.log(`  stat mapping: ${sm.written}, ${sm.count} entries`)
  }

  // Equips (AKEDatabase/public/CH as primary source)
  console.log('\n-- Equips (>=5star) --')
  const equipResult = compareEquips(paths.akedata, join(projectRoot, 'src', 'data', 'equips.ts'), paths.imagedb)
  console.log(`  Total: ${equipResult.entries.length} | New: ${equipResult.newCount}`)
  for (const e of equipResult.entries) {
    if (e.isNew) console.log(`  NEW  ${e.equipId}: ${e.name} (${e.rarity}star, ${e.slot})`)
  }
  if (mode === 'update') {
    // Update equips.ts with new equips
    const newEquipIds = equipResult.entries.filter(e => e.isNew).map(e => e.equipId)
    if (newEquipIds.length > 0) {
      const equipsTsPath = join(projectRoot, 'src', 'data', 'equips.ts')
      const updated = updateEquipsFile(equipsTsPath, newEquipIds, paths.imagedb, paths.akedata, paths.translation)
      console.log(`  Updated: ${updated} equips added to equips.ts`)
    }
    const r = generateEquipI18n(paths.akedata, paths.imagedb, paths.translation, generatedRoot)
    console.log(`  i18n: ${r.written.length} files, ${r.count} entries, ${r.missing} missing`)
    const em = generateEquipStatMapping(paths.akedata, paths.translation, join(projectRoot, 'src', 'generated'))
    console.log(`  stat mapping: ${em.written}, ${em.count} entries`)
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
      const updated = updateDungeonsFile(dungeonsTsPath, newDungeonIds, paths.akedata, paths.translation)
      console.log(`  Updated: ${updated} dungeons added to dungeons.ts`)
    }
    const r = generateDungeonI18n(paths.akedata, paths.translation, generatedRoot)
    console.log(`  Dungeon i18n: ${r.dungeonWritten.length} files, ${r.dungeonCount} dungeons`)
    console.log(`  Region i18n: ${r.regionWritten.length} files, ${r.regionCount} regions`)
  }

  // Metadata: equip types, materials (with abbreviation->full mapping), suit names
  console.log('\n-- Metadata --')
  if (mode === 'update') {
    const m = generateMetadataI18n(paths.translation, generatedRoot, paths.imagedb, paths.akedata)
    console.log(`  i18n: ${m.files} files, ${m.terms} terms`)
  }

  // Generate stat i18n — gemStats (weapons/dungeons) + equipStats (equipment)
  if (mode === 'update') {
    console.log('\n-- Stat i18n --')
    const r = generateStatI18n(paths.akedata, paths.translation, paths.imagedb, generatedRoot)
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
  const validationIssues = validateAllData(paths.imagedb, paths.akedata, paths.translation, projectRoot)
  if (validationIssues.length > 0) {
    console.log(`  Found ${validationIssues.length} data inconsistency:`)
    for (const issue of validationIssues) {
      console.log(`  [${issue.category}] ${issue.id}.${issue.field}: expected "${issue.expected}", got "${issue.actual}"`)
    }
  } else {
    console.log(`  All data consistent with upstream`)
  }

  // Validate image existence (always)
  const missingImages = validateImages(projectRoot)
  if (missingImages.length > 0) {
    console.log(`\n  Missing images (${missingImages.length}):`)
    for (const img of missingImages) {
      console.log(`    ${img}`)
    }
  } else {
    console.log(`  All images present`)
  }

  // Convert missing images (always, based on project data, not just new items)
  if (mode === 'update') {
    console.log('\n-- Image conversion --')
    // Collect all image IDs referenced by project data
    const targetIds: string[] = []
    // Weapon IDs from weapons.ts
    const wIds = readFileSync(join(projectRoot, 'src', 'data', 'weapons.ts'), 'utf-8')
      .match(/id:\s*'(wpn_[^']+)'/g)
      ?.map(m => m.replace(/id:\s*'([^']+)'/, '$1'))
      .filter((id): id is string => !!id && !id.startsWith('preview:')) ?? []
    targetIds.push(...wIds)
    // Equip image IDs from EQUIP_ID_MAP values
    const eIds = readFileSync(join(projectRoot, 'src', 'data', 'equips.ts'), 'utf-8')
      .match(/':\s*'(item_equip_[^']+)'/g)
      ?.map(m => m.replace(/':\s*'([^']+)'/, '$1'))
      .filter((id): id is string => !!id) ?? []
    targetIds.push(...eIds)

    if (targetIds.length > 0) {
      const iconResult = await convertIcons(paths.imagedb, join(projectRoot, 'public'), ['weapon', 'equip'], targetIds)
      console.log(`  Weapons+equips: ${targetIds.length} targets, ${iconResult.converted.length} converted, ${iconResult.skipped.length} skipped, ${iconResult.missingSource.length} missing source`)
    } else {
      console.log(`  No image IDs found in project data`)
    }
  }

  // SHA update
  if (mode === 'update' && !local) {
    console.log('\n-- Updating SHA --')
    updateTrackingBranch({ akedata: getRepoHead(paths.akedata), translation: getRepoHead(paths.translation) })
  }

  console.log('\n  Done\n')
}

main().catch(err => { console.error(err); process.exit(1) })
