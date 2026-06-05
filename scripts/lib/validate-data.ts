/**
 * Validate existing project data against upstream game data.
 * Reports differences without modifying any files.
 * ================================================================================
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseLossless } from 'lossless-json'
import { buildGemTableLookup } from './stat-mapping'

// ── Lossless JSON parsing ─────────────────────────────────────────────────

function convertLosslessToPlain(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'object' && 'isLosslessNumber' in value) {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(convertLosslessToPlain)
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = convertLosslessToPlain(v)
    }
    return result
  }
  return value
}

function parseJsonSafe(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parseLossless(raw)
  return convertLosslessToPlain(parsed)
}

// ── Validation result ─────────────────────────────────────────────────────

export interface ValidationIssue {
  category: 'weapon' | 'equip' | 'dungeon'
  id: string
  field: string
  expected: string
  actual: string
}

// ── Validate weapons ──────────────────────────────────────────────────────

export function validateWeapons(
  imagedbPath: string,
  akedataPath: string,
  translationPath: string,
  projectWeaponsTsPath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Read project weapons data
  if (!existsSync(projectWeaponsTsPath)) return issues
  const projectContent = readFileSync(projectWeaponsTsPath, 'utf-8')

  // Extract weapon data from project file
  const weaponRegex = /\{\s*id:\s*'([^']+)',\s*name:\s*'[^']*',\s*rarity:\s*\d+,\s*type:\s*'[^']*',\s*primaryStat:\s*'([^']*)',\s*elementalDamage:\s*'([^']*)',\s*specialAbility:\s*'([^']*)'/g
  const projectWeapons = new Map<string, { primaryStat: string; elementalDamage: string; specialAbility: string }>()
  let m: RegExpExecArray | null
  while ((m = weaponRegex.exec(projectContent)) !== null) {
    projectWeapons.set(m[1], { primaryStat: m[2], elementalDamage: m[3], specialAbility: m[4] })
  }

  // Read upstream weapon data
  const primaryDir = join(imagedbPath, 'public', 'CH', 'weapon')
  const fallbackDir = join(akedataPath, 'output', 'CN', 'weapon')
  const weaponDir = existsSync(primaryDir) ? primaryDir : existsSync(fallbackDir) ? fallbackDir : null
  if (!weaponDir) return issues

  // Blackboard key → gemTermId suffix (same as update-data-files.ts)
  const BB_TO_SUFFIX: Record<string, string> = {
    str: 'str', agi: 'agi', wisd: 'wisd', will: 'will', mainattr: 'main',
    atk: 'atk', hp: 'hp', phydam: 'phydam',
    firedam: 'firedam', electrondam: 'pulsedam', pulsedam: 'pulsedam',
    icedam: 'icedam', crystdam: 'icedam',
    naturaldam: 'naturaldam', crirate: 'crirate',
    usp: 'usp', usgs: 'usp',
    heal: 'heal', physpell: 'physpell', spelldam: 'magicdam',
  }
  const PRIMARY_KEYS = new Set(['str', 'agi', 'wisd', 'will', 'mainattr'])

  // Build GemTable CN→gemTermId for special ability resolution
  const { cnToGem } = buildGemTableLookup(akedataPath, translationPath)

  for (const file of readdirSync(weaponDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const weaponId = file.replace('.json', '')
    const projectWeapon = projectWeapons.get(weaponId)
    if (!projectWeapon) continue // Skip new weapons (handled elsewhere)

    const data = JSON.parse(readFileSync(join(weaponDir, file), 'utf-8'))
    const skilllist = data.skilllist ?? []

    // Extract upstream stats (blackboard key → gemTermId)
    let upstreamPrimaryStat = ''
    let upstreamElementalDamage = ''
    let upstreamSpecialAbility = ''
    for (const skill of skilllist) {
      const bbKey = skill.blackboard?.[0]?.key
      if (!bbKey) continue

      const suffix = BB_TO_SUFFIX[bbKey]
      if (!suffix) {
        const idx = skill.skillName.indexOf('·')
        const baseName = idx === -1 ? skill.skillName : skill.skillName.slice(0, idx)
        const gemId = cnToGem[baseName]
        if (gemId && !upstreamSpecialAbility) upstreamSpecialAbility = gemId
        continue
      }

      const gemId = `gat_passive_attr_${suffix}`
      if (PRIMARY_KEYS.has(bbKey)) {
        if (!upstreamPrimaryStat) upstreamPrimaryStat = gemId
      } else {
        if (!upstreamElementalDamage) upstreamElementalDamage = gemId
      }
    }

    // Compare
    if (upstreamPrimaryStat && upstreamPrimaryStat !== projectWeapon.primaryStat) {
      issues.push({ category: 'weapon', id: weaponId, field: 'primaryStat', expected: upstreamPrimaryStat, actual: projectWeapon.primaryStat || '<empty>' })
    } else if (!upstreamPrimaryStat && projectWeapon.primaryStat) {
      issues.push({ category: 'weapon', id: weaponId, field: 'primaryStat', expected: '<empty>', actual: projectWeapon.primaryStat })
    } else if (upstreamPrimaryStat && !projectWeapon.primaryStat) {
      issues.push({ category: 'weapon', id: weaponId, field: 'primaryStat', expected: upstreamPrimaryStat, actual: '<empty>' })
    }
    if (upstreamElementalDamage && upstreamElementalDamage !== projectWeapon.elementalDamage) {
      issues.push({ category: 'weapon', id: weaponId, field: 'elementalDamage', expected: upstreamElementalDamage, actual: projectWeapon.elementalDamage || '<empty>' })
    } else if (!upstreamElementalDamage && projectWeapon.elementalDamage) {
      issues.push({ category: 'weapon', id: weaponId, field: 'elementalDamage', expected: '<empty>', actual: projectWeapon.elementalDamage })
    } else if (upstreamElementalDamage && !projectWeapon.elementalDamage) {
      issues.push({ category: 'weapon', id: weaponId, field: 'elementalDamage', expected: upstreamElementalDamage, actual: '<empty>' })
    }
    if (upstreamSpecialAbility && upstreamSpecialAbility !== projectWeapon.specialAbility) {
      issues.push({ category: 'weapon', id: weaponId, field: 'specialAbility', expected: upstreamSpecialAbility, actual: projectWeapon.specialAbility || '<empty>' })
    } else if (!upstreamSpecialAbility && projectWeapon.specialAbility) {
      issues.push({ category: 'weapon', id: weaponId, field: 'specialAbility', expected: '<empty>', actual: projectWeapon.specialAbility })
    } else if (upstreamSpecialAbility && !projectWeapon.specialAbility) {
      issues.push({ category: 'weapon', id: weaponId, field: 'specialAbility', expected: upstreamSpecialAbility, actual: '<empty>' })
    }
  }

  return issues
}

// ── Validate dungeons ─────────────────────────────────────────────────────

export function validateDungeons(
  akedataPath: string,
  translationPath: string,
  projectDungeonsTsPath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!existsSync(projectDungeonsTsPath)) return issues
  const projectContent = readFileSync(projectDungeonsTsPath, 'utf-8')

  // Load group table
  const groupTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointGroupTable.json')
  if (!existsSync(groupTablePath)) return issues
  const groupTable = parseJsonSafe(groupTablePath) as Record<string, Record<string, unknown>>

  // Extract project dungeon data (now stores gemTermId directly)
  const dungeonRegex = /\{\s*id:\s*'([^']+)',\s*name:\s*'[^']*',\s*s1Pool:\s*\[([^\]]*)\],\s*s2Pool:\s*\[([^\]]*)\],\s*s3Pool:\s*\[([^\]]*)\]/g
  const projectDungeons = new Map<string, { s1Pool: string[]; s2Pool: string[]; s3Pool: string[] }>()
  let m: RegExpExecArray | null
  while ((m = dungeonRegex.exec(projectContent)) !== null) {
    const parseArr = (s: string) => s.split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean)
    projectDungeons.set(m[1], { s1Pool: parseArr(m[2]), s2Pool: parseArr(m[3]), s3Pool: parseArr(m[4]) })
  }

  // Compare each dungeon (direct gemTermId comparison)
  for (const [groupId, gData] of Object.entries(groupTable)) {
    const projectDungeon = projectDungeons.get(groupId)
    if (!projectDungeon) continue

    const upstreamS1 = (gData.primAttrTermIds ?? []) as string[]
    const upstreamS2 = (gData.secAttrTermIds ?? []) as string[]
    const upstreamS3 = (gData.skillTermIds ?? []) as string[]

    const setEq = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === new Set(b).size && a.every(v => new Set(b).has(v))

    if (!setEq(projectDungeon.s1Pool, upstreamS1)) {
      issues.push({ category: 'dungeon', id: groupId, field: 's1Pool', expected: `[${upstreamS1.join(', ')}]`, actual: `[${projectDungeon.s1Pool.join(', ')}]` })
    }
    if (!setEq(projectDungeon.s2Pool, upstreamS2)) {
      issues.push({ category: 'dungeon', id: groupId, field: 's2Pool', expected: `[${upstreamS2.join(', ')}]`, actual: `[${projectDungeon.s2Pool.join(', ')}]` })
    }
    if (!setEq(projectDungeon.s3Pool, upstreamS3)) {
      issues.push({ category: 'dungeon', id: groupId, field: 's3Pool', expected: `[${upstreamS3.join(', ')}]`, actual: `[${projectDungeon.s3Pool.join(', ')}]` })
    }
  }

  return issues
}

// ── Validate image existence ──────────────────────────────────────────────

export function validateImages(projectRoot: string): string[] {
  const missing: string[] = []
  const publicDir = join(projectRoot, 'public')

  // Check weapon images
  const weaponsPath = join(projectRoot, 'src', 'data', 'weapons.ts')
  if (existsSync(weaponsPath)) {
    const content = readFileSync(weaponsPath, 'utf-8')
    const weaponIdRegex = /id:\s*'([^']+)'/g
    let m: RegExpExecArray | null
    while ((m = weaponIdRegex.exec(content)) !== null) {
      const weaponId = m[1]
      if (weaponId.startsWith('preview:')) continue // Skip preview weapons
      const avifPath = join(publicDir, 'images', 'weapon', `${weaponId}.avif`)
      if (!existsSync(avifPath)) {
        missing.push(`weapon/${weaponId}.avif`)
      }
    }
  }

  // Check equip images (from EQUIP_ID_MAP values)
  const equipsPath = join(projectRoot, 'src', 'data', 'equips.ts')
  if (existsSync(equipsPath)) {
    const content = readFileSync(equipsPath, 'utf-8')
    // Match EQUIP_ID_MAP values: 'name': 'item_equip_xxx'
    const equipIdRegex = /':\s*'(item_equip_[^']+)'/g
    let m: RegExpExecArray | null
    while ((m = equipIdRegex.exec(content)) !== null) {
      const equipId = m[1]
      const avifPath = join(publicDir, 'images', 'equip', `${equipId}.avif`)
      if (!existsSync(avifPath)) {
        missing.push(`equip/${equipId}.avif`)
      }
    }
  }

  return missing
}

// ── Main validation function ──────────────────────────────────────────────

export function validateAllData(
  imagedbPath: string,
  akedataPath: string,
  translationPath: string,
  projectRoot: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateWeapons(imagedbPath, akedataPath, translationPath, join(projectRoot, 'src', 'data', 'weapons.ts')),
    ...validateDungeons(akedataPath, translationPath, join(projectRoot, 'src', 'data', 'dungeons.ts')),
  ]
  return issues
}
