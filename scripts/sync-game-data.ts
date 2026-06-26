#!/usr/bin/env node
import { resolvePaths, getRepoHead, validatePaths } from './lib/upstream'
import { generateWeaponI18n } from './lib/generate-weapons'
import { generateWeaponStatsI18n } from './lib/generate-weapon-stats-i18n'
import { generateEquipI18n } from './lib/generate-equips'
import { generateDungeonI18n } from './lib/generate-dungeons'
import { generateMetadataI18n } from './lib/generate-metadata'
import { generateStatI18n } from './lib/generate-stat-i18n'
import { compareWeapons } from './lib/compare-weapons'
import { compareEquips } from './lib/compare-equips'
import { compareDungeons } from './lib/compare-dungeons'
import { updateWeaponsFile, updateEquipsFile, updateDungeonsFile, reconcileWeaponsIconIds } from './lib/update-data-files'
import { validateAllData, validateImages } from './lib/validate-data'
import { convertIcons } from './lib/convert-icons'
import { readUpstreamVersions, writeUpstreamVersions } from './lib/git-helpers'
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
    if (
      versions.akedata &&
      currentAkedata === versions.akedata
    ) {
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
      // Block PR creation when iconId issues exist
      console.error('  iconId reconciliation required. Run sync:update to fix.')
      process.exit(2)
    }
  } else if (iconIdReconcile.unchanged > 0) {
    console.log(`  iconId: ${iconIdReconcile.unchanged} verified, ${iconIdReconcile.skipped} skipped (no upstream entry)`)
  }
  // Preview weapon detection and update
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
    // Update weapons.ts with new weapons.
    // Exclude weapons that were just promoted from preview → formal IDs:
    // compareWeapons() ran before updatePreviewWeapons(), so a promoted weapon
    // still appears as "new" in wpnResult.entries. Filtering it out prevents a
    // duplicate append — the preview entry was already renamed in-place (with
    // its chars preserved), so appending again would create two entries with
    // the same id.
    const promotedFormalIds = new Set(previewResult.updatable.map(p => p.formalId))
    const newWeaponIds = wpnResult.entries
      .filter(w => w.isNew && w.rarity >= 4 && !promotedFormalIds.has(w.weaponId))
      .map(w => w.weaponId)
    if (newWeaponIds.length > 0) {
      const updated = updateWeaponsFile(weaponsTsPath, newWeaponIds, paths.imagedb, paths.akedata)
      console.log(`  Updated: ${updated} weapons added to weapons.ts`)
    }
    // Reconcile iconId field against upstream ItemTable.iconId
    // (adds missing iconId, fixes incorrect iconId for existing weapons)
    const iconIdFix = reconcileWeaponsIconIds(weaponsTsPath, paths.akedata, false)
    if (iconIdFix.added > 0 || iconIdFix.updated > 0) {
      console.log(`  iconId reconciled: ${iconIdFix.added} added, ${iconIdFix.updated} updated, ${iconIdFix.unchanged} unchanged`)
    }
    const r = generateWeaponI18n(paths.akedata, paths.imagedb, generatedRoot)
    console.log(`  i18n: ${r.written.length} files, ${r.count} wpns, ${r.missing} missing`)
    const ws = generateWeaponStatsI18n(paths.imagedb, paths.akedata, generatedRoot)
    console.log(`  weaponStats: ${ws.written.length} files, ${ws.count} entries, ${ws.missing} missing`)
  }

  // Equips (AKEDatabase/public/CH as primary source)
  console.log('\n-- Equips (>=5star) --')
  const equipResult = compareEquips(paths.akedata, join(projectRoot, 'src', 'data', 'equips.ts'), paths.imagedb)
  console.log(`  Total: ${equipResult.entries.length} | New: ${equipResult.newCount}`)
  for (const e of equipResult.entries) {
    if (e.isNew) console.log(`  NEW  ${e.equipId}: ${e.name} (${e.rarity}star, ${e.slot})`)
  }
  if (mode === 'update') {
    // Reconcile all equips: add new ones + fix any drifted values
    const newEquipIds = equipResult.entries.filter(e => e.isNew).map(e => e.equipId)
    const equipsTsPath = join(projectRoot, 'src', 'data', 'equips.ts')
    const updated = updateEquipsFile(equipsTsPath, newEquipIds, paths.imagedb, paths.akedata, true)
    console.log(`  Reconciled: ${updated} equips synced`)
    const r = generateEquipI18n(paths.akedata, paths.imagedb, generatedRoot)
    console.log(`  i18n: ${r.written.length} files, ${r.count} entries, ${r.missing} missing`)
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
    const m = generateMetadataI18n(paths.akedata, generatedRoot, paths.imagedb)
    console.log(`  i18n: ${m.files} files, ${m.terms} terms`)
  }

  // Generate stat i18n — gemStats (weapons/dungeons) + equipStats (equipment)
  if (mode === 'update') {
    console.log('\n-- Stat i18n --')
    const r = generateStatI18n(paths.akedata, paths.imagedb, generatedRoot)
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
  const validationIssues = validateAllData(paths.imagedb, paths.akedata, projectRoot)
  if (validationIssues.length > 0) {
    console.log(`  Found ${validationIssues.length} data inconsistency:`)
    for (const issue of validationIssues) {
      console.log(`  [${issue.category}] ${issue.id}.${issue.field}: expected "${issue.expected}", got "${issue.actual}"`)
    }
  } else {
    console.log(`  All data consistent with upstream`)
  }

  // Convert images (update mode only, before validation so newly-converted AVIFs pass the check)
  if (mode === 'update') {
    console.log('\n-- Image conversion --')
    // Collect all image IDs referenced by project data
    const targetIds: string[] = []
    // Weapon image IDs: union of id + iconId from weapons.ts inline fields
    // iconId 与 id 不同时（如 wpn_funnel_0008/0010 游戏资源交叉指向），
    // 必须同时转换 id 和 iconId 对应的 PNG，否则渲染层取不到 AVIF。
    const wIds = readFileSync(join(projectRoot, 'src', 'data', 'weapons.ts'), 'utf-8')
      .match(/(?:id|iconId):\s*'(wpn_[^']+)'/g)
      ?.map(m => m.replace(/(?:id|iconId):\s*'([^']+)'/, '$1'))
      .filter((id): id is string => !!id && !id.startsWith('preview:')) ?? []
    targetIds.push(...new Set(wIds))
    // Equip image IDs: union of equipId + iconId from RAW_EQUIPS inline fields
    const equipContent = readFileSync(join(projectRoot, 'src', 'data', 'equips.ts'), 'utf-8')
    const eIdSet = new Set<string>()
    const eIdRe = /(?:equipId|iconId):\s*'(item_equip_[^']+)'/g
    let em: RegExpExecArray | null
    while ((em = eIdRe.exec(equipContent)) !== null) eIdSet.add(em[1])
    targetIds.push(...eIdSet)

    if (targetIds.length > 0) {
      const iconResult = await convertIcons(paths.imagedb, join(projectRoot, 'public'), ['weapon', 'equip'], targetIds)
      console.log(`  Weapons+equips: ${targetIds.length} targets, ${iconResult.converted.length} converted, ${iconResult.skipped.length} skipped, ${iconResult.missingSource.length} missing source`)
      if (iconResult.missingSource.length > 0) {
        console.log(`  Missing source PNGs (cannot convert):`)
        for (const src of iconResult.missingSource) {
          console.log(`    ${src}`)
        }
      }
    } else {
      console.log(`  No image IDs found in project data`)
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
    })
  }

  console.log('\n  Done\n')
}

main().catch(err => { console.error(err); process.exit(1) })
