/**
 * Validate existing project data against upstream game data.
 * Reports differences without modifying any files.
 * ================================================================================
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseLossless } from 'lossless-json'
import { buildGemTableLookup } from './stat-mapping'
import { buildAttrShowConfigs, resolveFormat, formatEquipStat } from './equip-stat-format'

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
  const { cnToGem } = buildGemTableLookup(akedataPath)

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

// ── Validate equips ─────────────────────────────────────────────────────

export function validateEquips(
  imagedbPath: string,
  akedataPath: string,
  projectEquipsTsPath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Read project equips data
  if (!existsSync(projectEquipsTsPath)) return issues
  const projectContent = readFileSync(projectEquipsTsPath, 'utf-8')

  // Extract RAW_EQUIPS entries: field-order-independent parsing
  // Find each object block and extract fields individually to avoid
  // breakage when field order, quoting style, or formatting changes.
  const projectEquips = new Map<string, { name: string; sub1: string; sub2: string; special: string }>()
  const rawArrayStart = projectContent.indexOf('const RAW_EQUIPS')
  if (rawArrayStart !== -1) {
    const arrOpen = projectContent.indexOf('[', rawArrayStart)
    if (arrOpen !== -1) {
      let depth = 0
      let objStart = -1
      for (let i = arrOpen; i < projectContent.length; i++) {
        if (projectContent[i] === '{') {
          if (depth === 0) objStart = i
          depth++
        } else if (projectContent[i] === '}') {
          depth--
          if (depth === 0 && objStart !== -1) {
            const objText = projectContent.slice(objStart, i + 1)
            const field = (re: RegExp) => { const m = re.exec(objText); return m ? m[1] : '' }
            const name = field(/name:\s*['"]([^'"]*)['"]/)
            const sub1 = field(/sub1:\s*['"]([^'"]*)['"]/)
            const sub2 = field(/sub2:\s*['"]([^'"]*)['"]/)
            const special = field(/special:\s*['"]([^'"]*)['"]/)
            const equipId = field(/equipId:\s*['"]([^'"]*)['"]/)
            const iconId = field(/iconId:\s*['"]([^'"]*)['"]/)
            const key = equipId || iconId
            if (name && key) {
              projectEquips.set(key, { name, sub1, sub2, special })
            }
            objStart = -1
          }
        }
      }
    }
  }

  // Read upstream v2_equip data
  const v2EquipDir = join(imagedbPath, 'public', 'CH', 'v2_equip')
  if (!existsSync(v2EquipDir)) return issues

  // Build attrType → AttrShowConfig and compositeAttr → AttrShowConfig (with valueFormat)
  const { attrTypeMap, compositeCfg } = buildAttrShowConfigs(akedataPath)

  // For each v2_equip file, compare project equips against upstream
  for (const file of readdirSync(v2EquipDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const suitData = parseJsonSafe(join(v2EquipDir, file)) as Record<string, unknown>
    const equiptable = (suitData.equiptable ?? {}) as Record<string, { displayAttrModifiers?: { attrIndex: number; attrType: number; attrValue: number; modifierType?: number; compositeAttr?: string }[] }>
    const itemtable = (suitData.itemtable ?? {}) as Record<string, { name?: { text?: string } }>

    for (const [upstreamEquipId, equipData] of Object.entries(equiptable)) {
      const equipItem = itemtable[upstreamEquipId]
      const equipName = equipItem?.name?.text ?? ''
      if (!equipName) continue

      // Look up project equip by equipId (O(1))
      const projectEquip = projectEquips.get(upstreamEquipId)
      if (!projectEquip) continue // Not in project data

      // Build upstream stat strings from displayAttrModifiers
      let upstreamSub1 = ''
      let upstreamSub2 = ''
      let upstreamSpecial = ''

      for (const mod of equipData.displayAttrModifiers ?? []) {
        if (Number(mod.attrIndex) === 0) continue

        const modType = Number(mod.modifierType ?? 5)
        const attrType = Number(mod.attrType)
        const compositeAttr = String(mod.compositeAttr ?? '')

        let key: string
        let valueFormat: string

        if (attrType === 0 && compositeAttr) {
          key = compositeAttr
          valueFormat = resolveFormat(compositeCfg.get(compositeAttr), compositeAttr, modType)
        } else {
          const attrInfo = attrTypeMap.get(attrType)
          if (!attrInfo) continue
          key = String(attrType)
          valueFormat = resolveFormat(attrInfo, String(attrType), modType)
        }

        const statStr = formatEquipStat(key, String(mod.attrValue), valueFormat)
        if (Number(mod.attrIndex) === 1) upstreamSub1 = statStr
        else if (Number(mod.attrIndex) === 2) upstreamSub2 = statStr
        else if (Number(mod.attrIndex) === 3) upstreamSpecial = statStr
      }

      // Compare each field
      if (upstreamSub1 && upstreamSub1 !== projectEquip.sub1) {
        issues.push({ category: 'equip', id: equipName, field: 'sub1', expected: upstreamSub1, actual: projectEquip.sub1 || '<empty>' })
      } else if (!upstreamSub1 && projectEquip.sub1) {
        issues.push({ category: 'equip', id: equipName, field: 'sub1', expected: '<empty>', actual: projectEquip.sub1 })
      } else if (upstreamSub1 && !projectEquip.sub1) {
        issues.push({ category: 'equip', id: equipName, field: 'sub1', expected: upstreamSub1, actual: '<empty>' })
      }
      if (upstreamSub2 && upstreamSub2 !== projectEquip.sub2) {
        issues.push({ category: 'equip', id: equipName, field: 'sub2', expected: upstreamSub2, actual: projectEquip.sub2 || '<empty>' })
      } else if (!upstreamSub2 && projectEquip.sub2) {
        issues.push({ category: 'equip', id: equipName, field: 'sub2', expected: '<empty>', actual: projectEquip.sub2 })
      } else if (upstreamSub2 && !projectEquip.sub2) {
        issues.push({ category: 'equip', id: equipName, field: 'sub2', expected: upstreamSub2, actual: '<empty>' })
      }
      if (upstreamSpecial && upstreamSpecial !== projectEquip.special) {
        issues.push({ category: 'equip', id: equipName, field: 'special', expected: upstreamSpecial, actual: projectEquip.special || '<empty>' })
      } else if (!upstreamSpecial && projectEquip.special) {
        issues.push({ category: 'equip', id: equipName, field: 'special', expected: '<empty>', actual: projectEquip.special })
      } else if (upstreamSpecial && !projectEquip.special) {
        issues.push({ category: 'equip', id: equipName, field: 'special', expected: upstreamSpecial, actual: '<empty>' })
      }
    }
  }

  return issues
}

// ── Validate dungeons ─────────────────────────────────────────────────────

export function validateDungeons(
  akedataPath: string,
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
  // 优先用 iconId（游戏原始资源映射）；缺失时回退到 id
  const weaponsPath = join(projectRoot, 'src', 'data', 'weapons.ts')
  if (existsSync(weaponsPath)) {
    const content = readFileSync(weaponsPath, 'utf-8')
    // Match each weapon entry as a block, then extract id + iconId
    // preview:xxx 跳过（无对应游戏数据/图片）
    const entryRe = /\{[^}]*\}/g
    let m: RegExpExecArray | null
    while ((m = entryRe.exec(content)) !== null) {
      const entry = m[0]
      const idMatch = /id:\s*'([^']+)'/.exec(entry)
      if (!idMatch) continue
      const weaponId = idMatch[1]
      if (weaponId.startsWith('preview:')) continue
      const iconIdMatch = /iconId:\s*'([^']+)'/.exec(entry)
      const imageId = iconIdMatch?.[1] ?? weaponId
      const avifPath = join(publicDir, 'images', 'weapon', `${imageId}.avif`)
      if (!existsSync(avifPath)) {
        const ref = imageId === weaponId ? weaponId : `${imageId} (referenced by ${weaponId})`
        missing.push(`weapon/${ref}.avif`)
      }
    }
  }

  // Check equip images (from RAW_EQUIPS equipId and iconId fields)
  const equipsPath = join(projectRoot, 'src', 'data', 'equips.ts')
  if (existsSync(equipsPath)) {
    const content = readFileSync(equipsPath, 'utf-8')
    // Collect all unique icon IDs from equipId and iconId fields
    const iconIds = new Set<string>()
    const equipIdRegex = /(?:equipId|iconId):\s*'(item_equip_[^']+)'/g
    let m: RegExpExecArray | null
    while ((m = equipIdRegex.exec(content)) !== null) {
      iconIds.add(m[1])
    }
    for (const equipId of iconIds) {
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
  projectRoot: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateWeapons(imagedbPath, akedataPath, join(projectRoot, 'src', 'data', 'weapons.ts')),
    ...validateEquips(imagedbPath, akedataPath, join(projectRoot, 'src', 'data', 'equips.ts')),
    ...validateDungeons(akedataPath, join(projectRoot, 'src', 'data', 'dungeons.ts')),
  ]
  return issues
}
