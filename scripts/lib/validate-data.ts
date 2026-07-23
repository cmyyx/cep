/**
 * Validate existing project data against upstream game data.
 * Reports differences without modifying any files.
 * Weapon data sourced from AKEData/TableCfg/ (WeaponBasicTable, SkillPatchTable).
 * ================================================================================
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseJsonSafe } from './json-utils'
import { buildGemTableLookup, loadTextTable } from './stat-mapping'
import { extractItemNameIds } from './extract-textid'
import { WEAPON_TYPE_MAP } from './compare-weapons'
import { buildAttrShowConfigs, resolveFormat, formatEquipStat } from './equip-stat-format'
import { resolveWeaponStats } from './weapon-stats'
import type { WeaponSkillPatchEntry } from './weapon-stats'
import type { WikiAssets } from './wiki-assets'

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
  akedataPath: string,
  projectWeaponsTsPath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!existsSync(projectWeaponsTsPath)) {
    return [{
      category: 'weapon',
      id: projectWeaponsTsPath,
      field: 'file',
      expected: 'present',
      actual: '<missing>',
    }]
  }
  const projectContent = readFileSync(projectWeaponsTsPath, 'utf-8')

  const weaponRegex = /\{\s*id:\s*'([^']+)'(?:,\s*iconId:\s*'[^']*')?,\s*name:\s*'((?:\\.|[^'\\])*)',\s*rarity:\s*(\d+),\s*type:\s*'([^']*)',\s*primaryStat:\s*(?:'([^']*)'|(null)),\s*elementalDamage:\s*(?:'([^']*)'|(null)),\s*specialAbility:\s*(?:'([^']*)'|(null))/g
  const projectWeapons = new Map<string, { name: string; rarity: number; type: string; primaryStat: string | null; elementalDamage: string | null; specialAbility: string | null }>()
  let m: RegExpExecArray | null
  while ((m = weaponRegex.exec(projectContent)) !== null) {
    projectWeapons.set(m[1], {
      name: m[2].replace(/\\(['\\])/g, '$1'),
      rarity: Number(m[3]),
      type: m[4],
      primaryStat: m[6] ? null : m[5],
      elementalDamage: m[8] ? null : m[7],
      specialAbility: m[10] ? null : m[9],
    })
  }

  // Load WeaponBasicTable (all weapon metadata)
  const wpnBasicPath = join(akedataPath, 'TableCfg', 'WeaponBasicTable.json')
  if (!existsSync(wpnBasicPath)) {
    return [{
      category: 'weapon',
      id: 'WeaponBasicTable.json',
      field: 'file',
      expected: 'present',
      actual: '<missing>',
    }]
  }
  const wpnBasic = JSON.parse(readFileSync(wpnBasicPath, 'utf-8')) as Record<string, { rarity?: number; weaponType?: number; weaponSkillList?: string[] }>

  // Load SkillPatchTable (lossless-json for int64-safe skillName.id)
  const skillPatchPath = join(akedataPath, 'TableCfg', 'SkillPatchTable.json')
  const skillPatch = existsSync(skillPatchPath)
    ? parseJsonSafe(skillPatchPath) as Record<string, WeaponSkillPatchEntry>
    : {}

  const { cnToGem, tagToGem } = buildGemTableLookup(akedataPath)
  const cnTextTable = loadTextTable(akedataPath, 'zh-CN')
  const weaponNameTextIds = extractItemNameIds(join(akedataPath, 'TableCfg', 'ItemTable.json'))

  // Iterate WeaponBasicTable entries (76 weapons)
  for (const [weaponId, wpnData] of Object.entries(wpnBasic)) {
    const rarity = wpnData.rarity ?? 1
    if (rarity < 3) continue

    const projectWeapon = projectWeapons.get(weaponId)
    if (!projectWeapon) {
      issues.push({ category: 'weapon', id: weaponId, field: 'record', expected: 'present', actual: '<missing>' })
      continue
    }

    const nameTextId = weaponNameTextIds[weaponId] ?? ''
    const expectedName = nameTextId ? cnTextTable[nameTextId] : undefined
    if (!expectedName) {
      issues.push({
        category: 'weapon',
        id: weaponId,
        field: 'upstreamName',
        expected: 'localized name',
        actual: '<missing>',
      })
    } else if (expectedName !== projectWeapon.name) {
      issues.push({ category: 'weapon', id: weaponId, field: 'name', expected: expectedName, actual: projectWeapon.name })
    }
    if (rarity !== projectWeapon.rarity) {
      issues.push({ category: 'weapon', id: weaponId, field: 'rarity', expected: String(rarity), actual: String(projectWeapon.rarity) })
    }

    const expectedType = wpnData.weaponType !== undefined ? WEAPON_TYPE_MAP[wpnData.weaponType] : undefined
    if (!expectedType) {
      issues.push({
        category: 'weapon',
        id: weaponId,
        field: 'upstreamType',
        expected: 'known weapon type',
        actual: String(wpnData.weaponType ?? '<missing>'),
      })
    } else if (expectedType !== projectWeapon.type) {
      issues.push({ category: 'weapon', id: weaponId, field: 'type', expected: expectedType, actual: projectWeapon.type || '<empty>' })
    }

    const upstream = resolveWeaponStats(
      wpnData.weaponSkillList ?? [],
      skillPatch,
      tagToGem,
      cnTextTable,
      cnToGem,
    )
    if (upstream.unresolvedSkillIds.length > 0) {
      issues.push({
        category: 'weapon',
        id: weaponId,
        field: 'upstreamSkills',
        expected: 'all weapon skills resolved',
        actual: upstream.unresolvedSkillIds.join(', '),
      })
      continue
    }

    const compareField = (
      field: 'primaryStat' | 'elementalDamage' | 'specialAbility',
      expected: string | null,
    ) => {
      const actual = projectWeapon[field]
      if (expected !== actual) {
        issues.push({
          category: 'weapon',
          id: weaponId,
          field,
          expected: expected ?? '<empty>',
          actual: actual ?? '<empty>',
        })
      }
    }

    compareField('primaryStat', upstream.primaryStat)
    compareField('elementalDamage', upstream.elementalDamage)
    compareField('specialAbility', upstream.specialAbility)
  }

  for (const weaponId of projectWeapons.keys()) {
    if (weaponId.startsWith('preview:')) continue
    const upstream = wpnBasic[weaponId]
    if (!upstream || (upstream.rarity ?? 1) < 3) {
      issues.push({
        category: 'weapon',
        id: weaponId,
        field: 'record',
        expected: '<absent>',
        actual: 'present',
      })
    }
  }

  return issues
}

// ── Validate equips ─────────────────────────────────────────────────────

export function validateEquips(
  akedataPath: string,
  projectEquipsTsPath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!existsSync(projectEquipsTsPath)) return issues
  const projectContent = readFileSync(projectEquipsTsPath, 'utf-8')

  // Extract RAW_EQUIPS entries: field-order-independent parsing
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

  // Read upstream EquipTable from AKEData
  const equipTablePath = join(akedataPath, 'TableCfg', 'EquipTable.json')
  if (!existsSync(equipTablePath)) return issues
  const equipTable = parseJsonSafe(equipTablePath) as Record<string, { displayAttrModifiers?: { attrIndex: number; attrType: number; attrValue: number; modifierType?: number; compositeAttr?: string }[] }>

  // Resolve equip display names: ItemTable.name.id → I18nTextTable_CN
  const equipTextIds = extractItemNameIds(join(akedataPath, 'TableCfg', 'ItemTable.json'))
  const textTableCN = loadTextTable(akedataPath, 'zh-CN')

  // Build attrType → AttrShowConfig and compositeAttr → AttrShowConfig (with valueFormat)
  const { attrTypeMap, compositeCfg } = buildAttrShowConfigs(akedataPath)

  // For each equip in EquipTable, compare project equips against upstream
  for (const [upstreamEquipId, equipData] of Object.entries(equipTable)) {
    const nameTextId = equipTextIds[upstreamEquipId]
    const equipName = (nameTextId && textTableCN[nameTextId]) || ''
    if (!equipName) continue

    const projectEquip = projectEquips.get(upstreamEquipId)
    if (!projectEquip) continue // Skip new equips (handled by sync)

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

    const compareField = (field: string, upstream: string, project: string) => {
      if (upstream !== project) {
        issues.push({ category: 'equip', id: equipName, field, expected: upstream || '<empty>', actual: project || '<empty>' })
      }
    }
    compareField('sub1', upstreamSub1, projectEquip.sub1)
    compareField('sub2', upstreamSub2, projectEquip.sub2)
    compareField('special', upstreamSpecial, projectEquip.special)
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
    projectDungeons.set(m[1], {
      s1Pool: m[2].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean),
      s2Pool: m[3].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean),
      s3Pool: m[4].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean),
    })
  }

  // Compare pool contents against upstream group data
  for (const [groupId, groupData] of Object.entries(groupTable)) {
    const projectDungeon = projectDungeons.get(groupId)
    if (!projectDungeon) continue

    const upstreamS1 = (groupData.primAttrTermIds ?? []) as string[]
    const upstreamS2 = (groupData.secAttrTermIds ?? []) as string[]
    const upstreamS3 = (groupData.skillTermIds ?? []) as string[]

    const comparePool = (label: string, upstream: string[], project: string[]) => {
      const upSet = new Set(upstream)
      const projSet = new Set(project)
      const missing = upstream.filter(t => !projSet.has(t))
      const extra = project.filter(t => !upSet.has(t))
      if (missing.length > 0) {
        issues.push({ category: 'dungeon', id: groupId, field: `${label}_missing`, expected: missing.join(', '), actual: '' })
      }
      if (extra.length > 0) {
        issues.push({ category: 'dungeon', id: groupId, field: `${label}_extra`, expected: '', actual: extra.join(', ') })
      }
    }
    comparePool('s1', upstreamS1, projectDungeon.s1Pool)
    comparePool('s2', upstreamS2, projectDungeon.s2Pool)
    comparePool('s3', upstreamS3, projectDungeon.s3Pool)
  }

  return issues
}

// ── Validate image existence ──────────────────────────────────────────────

export function validateImages(
  projectRoot: string,
  options: { skipCharacterImages?: boolean } = {}
): string[] {
  const manifestPath = join(projectRoot, 'src', 'generated', 'data', 'wiki', 'assets.json')
  if (!existsSync(manifestPath)) return ['/src/generated/data/wiki/assets.json']
  const assets = JSON.parse(readFileSync(manifestPath, 'utf8')) as WikiAssets
  const characterPaths = options.skipCharacterImages
    ? []
    : [
        ...assets.characters.map((id) => `/images/characters/${id}.avif`),
        ...assets.characterFullBody.map((id) => `/images/characters/full/${id}.avif`),
      ]
  const paths = [
    ...characterPaths,
    ...assets.characterPotential.map((id) => `/images/wiki/character-potential/${id}.avif`),
    ...assets.weapons.map((id) => `/images/weapon/${id}.avif`),
    ...assets.equipment.map((id) => `/images/equip/${id}.avif`),
    ...assets.skills.map((id) => `/images/wiki/skills/${id}.avif`),
    ...assets.logisticsSkills.map((id) => `/images/wiki/logistics/${id}.avif`),
    ...assets.materials.map((id) => `/images/items/${id}.avif`),
  ]
  return paths.filter((path) => !existsSync(join(projectRoot, 'public', path)))
}

// ── Main validation function ──────────────────────────────────────────────

export function validateAllData(
  akedataPath: string,
  projectRoot: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateWeapons(akedataPath, join(projectRoot, 'src', 'data', 'weapons.ts')),
    ...validateEquips(akedataPath, join(projectRoot, 'src', 'data', 'equips.ts')),
    ...validateDungeons(akedataPath, join(projectRoot, 'src', 'data', 'dungeons.ts')),
  ]
  return issues
}
