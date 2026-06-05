/**
 * Auto-update data source files (weapons.ts, equips.ts, dungeons.ts, stat-i18n-map.ts)
 * when new entries are detected during sync.
 * ================================================================================
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseLossless } from 'lossless-json'
import { buildGemTableLookup, loadTextTable } from './stat-mapping'
import { buildEquipStatMapping } from './equip-stat-mapping'

// ── Types ─────────────────────────────────────────────────────────────────

interface WeaponData {
  weaponId: string
  title: string
  rarity: number
  weapontype: number
  skilllist: { skillName: string; blackboard: { key: string; value: unknown }[] }[]
}

interface DisplayAttrModifier {
  attrIndex: number
  attrType: number
  attrValue: number
}

interface EquipFormula {
  costItemId: string[]
  outcomeEquipId: string
}

interface V2EquipData {
  suitId: string
  equipsuittable: {
    list: { suitName: { text: string } }[]
  }
  equiptable: Record<string, {
    partType: number
    displayAttrModifiers: DisplayAttrModifier[]
    displayBaseAttrModifier: DisplayAttrModifier
  }>
  itemtable: Record<string, { name: { text: string } }>
  equipformulatable: Record<string, EquipFormula>
}

interface AttrInfo {
  name: string
  showPercent: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────

const WEAPON_TYPE_MAP: Record<number, string> = {
  1: '手铳',
  2: '单手剑',
  3: '双手剑',
  4: '施术单元',
  5: '长柄武器',
}

/** Map upstream partType → Chinese equip slot label. */
const PART_TYPE_MAP: Record<number, string> = {
  0: '护甲',
  1: '护手',
  2: '配件',
}

// ── Blackboard key → gemTermId suffix mapping ────────────────────────────

const BLACKBOARD_TO_GEM_SUFFIX: Record<string, string> = {
  str: 'str', agi: 'agi', wisd: 'wisd', will: 'will',
  mainattr: 'main',
  atk: 'atk', hp: 'hp', phydam: 'phydam',
  firedam: 'firedam', electrondam: 'pulsedam', pulsedam: 'pulsedam',
  icedam: 'icedam', crystdam: 'icedam',
  naturaldam: 'naturaldam', crirate: 'crirate',
  usp: 'usp', usgs: 'usp',
  heal: 'heal', physpell: 'physpell',
  spelldam: 'magicdam',
}

const PRIMARY_KEYS = new Set(['str', 'agi', 'wisd', 'will', 'mainattr'])

// ── Helper functions ──────────────────────────────────────────────────────

/** Extract base stat name from skillName (before '·') */
function extractBaseStatName(skillName: string): string {
  const idx = skillName.indexOf('·')
  return idx === -1 ? skillName : skillName.slice(0, idx)
}

/**
 * Extract weapon stats from skilllist, returning gemTermId directly.
 * Primary/elemental: resolved via blackboard[0].key → gemTermId suffix.
 * Special abilities: resolved via GemTable CN name lookup.
 */
function extractStatsFromSkillList(
  skilllist: WeaponData['skilllist'],
  cnToGem: Record<string, string>,
): {
  primaryStat: string
  elementalDamage: string
  specialAbility: string
} {
  let primaryStat = ''
  let elementalDamage = ''
  let specialAbility = ''

  for (const skill of skilllist) {
    const bbKey = skill.blackboard?.[0]?.key
    if (!bbKey) continue

    const suffix = BLACKBOARD_TO_GEM_SUFFIX[bbKey]
    if (!suffix) {
      // Not a blackboard-mapped stat — try special ability via CN name
      const baseName = extractBaseStatName(skill.skillName)
      const gemId = cnToGem[baseName]
      if (gemId && !specialAbility) specialAbility = gemId
      continue
    }

    const gemId = `gat_passive_attr_${suffix}`

    if (PRIMARY_KEYS.has(bbKey)) {
      if (!primaryStat) primaryStat = gemId
    } else {
      if (!elementalDamage) elementalDamage = gemId
    }
  }

  return { primaryStat, elementalDamage, specialAbility }
}

/**
 * Parse JSON file preserving large integers as strings.
 * Returns a plain object with large integers converted to strings.
 */
function parseJsonSafe(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parseLossless(raw)
  return convertLosslessToPlain(parsed)
}

/** Recursively convert LosslessNumber values to strings */
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

// ── Attribute name resolution ─────────────────────────────────────────────

/** Build attrType → AttrInfo mapping from AttributeShowConfigTable + TextTable */
function buildAttrTypeMap(akedataPath: string, textTables: Record<string, string>): Map<number, AttrInfo> {
  const attrMap = new Map<number, AttrInfo>()

  const configPath = join(akedataPath, 'TableCfg', 'AttributeShowConfigTable.json')
  if (!existsSync(configPath)) return attrMap

  const config = parseJsonSafe(configPath) as Record<string, {
    list: { name: { id: string }; showPercent: boolean }[]
  }>

  for (const [attrTypeStr, data] of Object.entries(config)) {
    const attrType = Number(attrTypeStr)
    if (!data.list || data.list.length === 0) continue

    const firstEntry = data.list[0]
    const nameId = firstEntry.name.id
    const name = textTables[nameId] ?? ''
    if (!name) continue

    attrMap.set(attrType, { name, showPercent: firstEntry.showPercent })
  }

  return attrMap
}

/** Format equip stat value based on showPercent flag */
function formatEquipStat(name: string, value: number, showPercent: boolean): string {
  if (showPercent) {
    return `${name}+${(value * 100).toFixed(1)}%`
  }
  return `${name}+${Math.round(value)}`
}
// ── Insertion helpers ─────────────────────────────────────────────────────

/**
 * Find the position just before the closing character of a container.
 * Searches for the pattern `name = [` or `name = {` and finds the matching close.
 */
function findContainerEnd(content: string, declarationPattern: string): number {
  const declIdx = content.indexOf(declarationPattern)
  if (declIdx === -1) return -1

  // Find the opening bracket/brace
  const openChar = content[declIdx + declarationPattern.length - 1]
  const closeChar = openChar === '[' ? ']' : '}'
  const openIdx = declIdx + declarationPattern.length - 1

  let depth = 0
  for (let i = openIdx; i < content.length; i++) {
    if (content[i] === openChar) depth++
    if (content[i] === closeChar) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Insert new entries before the closing character of a container */
function insertEntries(content: string, declarationPattern: string, newEntries: string[]): string {
  const closeIdx = findContainerEnd(content, declarationPattern)
  if (closeIdx === -1) return content

  // Find the last non-whitespace before the close character
  let lastContentIdx = closeIdx - 1
  while (lastContentIdx >= 0 && /\s/.test(content[lastContentIdx])) lastContentIdx--

  // Find the end of that line
  let lineEnd = lastContentIdx + 1
  while (lineEnd < content.length && content[lineEnd] !== '\n') lineEnd++

  return (
    content.slice(0, lineEnd) + '\n' +
    newEntries.join(',\n') +
    content.slice(lineEnd)
  )
}

/**
 * Insert RAW_EQUIPS entries grouped by set.
 * Finds the last entry of the same set and inserts after it.
 * If set not found, inserts at the end.
 */
function insertRawEquipsBySet(content: string, newEntries: { set: string; line: string }[]): string {
  const declPattern = 'const RAW_EQUIPS: RawEquip[] = ['
  const closeIdx = findContainerEnd(content, declPattern)
  if (closeIdx === -1) return content

  // Group new entries by set
  const bySet = new Map<string, string[]>()
  for (const entry of newEntries) {
    const arr = bySet.get(entry.set) ?? []
    arr.push(entry.line)
    bySet.set(entry.set, arr)
  }

  // For each set, find the last entry of that set in the content and insert after it
  let result = content
  for (const [set, lines] of bySet) {
    // Find all lines with this set name
    const setRegex = new RegExp(`set:\\s*'${set.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')
    let lastSetLineEnd = -1
    let m: RegExpExecArray | null
    while ((m = setRegex.exec(result)) !== null) {
      // Find the end of this line
      let lineEnd = m.index
      while (lineEnd < result.length && result[lineEnd] !== '\n') lineEnd++
      lastSetLineEnd = lineEnd
    }

    if (lastSetLineEnd !== -1) {
      // Insert after the last entry of this set
      result =
        result.slice(0, lastSetLineEnd) + '\n' +
        lines.join(',\n') +
        result.slice(lastSetLineEnd)
    } else {
      // Set not found, insert before the closing bracket
      const newCloseIdx = findContainerEnd(result, declPattern)
      if (newCloseIdx !== -1) {
        let lastContentIdx = newCloseIdx - 1
        while (lastContentIdx >= 0 && /\s/.test(result[lastContentIdx])) lastContentIdx--
        let lineEnd = lastContentIdx + 1
        while (lineEnd < result.length && result[lineEnd] !== '\n') lineEnd++
        result =
          result.slice(0, lineEnd) + '\n' +
          lines.join(',\n') +
          result.slice(lineEnd)
      }
    }
  }

  return result
}

// ── Update weapons.ts ─────────────────────────────────────────────────────

export function updateWeaponsFile(
  weaponsTsPath: string,
  newWeaponIds: string[],
  imagedbPath: string,
  akedataPath: string,
  translationPath: string,
): number {
  if (newWeaponIds.length === 0) return 0

  const content = readFileSync(weaponsTsPath, 'utf-8')

  // Build GemTable CN→gemTermId for special ability resolution
  const { cnToGem } = buildGemTableLookup(akedataPath, translationPath)

  const primaryDir = join(imagedbPath, 'public', 'CH', 'weapon')
  const fallbackDir = join(akedataPath, 'output', 'CN', 'weapon')
  const weaponDir = existsSync(primaryDir) ? primaryDir : existsSync(fallbackDir) ? fallbackDir : null
  if (!weaponDir) return 0

  const newWeapons: string[] = []
  for (const weaponId of newWeaponIds) {
    const filePath = join(weaponDir, `${weaponId}.json`)
    if (!existsSync(filePath)) continue

    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as WeaponData
    const { primaryStat, elementalDamage, specialAbility } = extractStatsFromSkillList(data.skilllist, cnToGem)
    const type = WEAPON_TYPE_MAP[data.weapontype] ?? '未知'

    const weaponEntry = `  { id: '${data.weaponId}', name: '${data.title}', rarity: ${data.rarity}, type: '${type}', primaryStat: '${primaryStat}', elementalDamage: '${elementalDamage}', specialAbility: '${specialAbility}', chars: [] }`
    newWeapons.push(weaponEntry)
  }

  if (newWeapons.length === 0) return 0

  const updatedContent = insertEntries(content, 'export const weapons = [', newWeapons)
  writeFileSync(weaponsTsPath, updatedContent, 'utf-8')
  return newWeapons.length
}

// ── Update equips.ts ──────────────────────────────────────────────────────

export function updateEquipsFile(
  equipsTsPath: string,
  newEquipIds: string[],
  imagedbPath: string,
  akedataPath: string,
  translationPath: string,
): number {
  if (newEquipIds.length === 0) return 0

  const content = readFileSync(equipsTsPath, 'utf-8')
  const textTables = loadTextTable(translationPath, 'zh-CN')
  const attrTypeMap = buildAttrTypeMap(akedataPath, textTables)
  const equipMapping = buildEquipStatMapping(akedataPath, translationPath)

  // Use v2_equip data source
  const v2EquipDir = join(imagedbPath, 'public', 'CH', 'v2_equip')
  if (!existsSync(v2EquipDir)) return 0

  const newIdMapEntries: string[] = []
  const newRawEquipEntries: { set: string; line: string }[] = []

  for (const file of readdirSync(v2EquipDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue

    const suitData = parseJsonSafe(join(v2EquipDir, file)) as V2EquipData
    const equiptable = suitData.equiptable ?? {}
    const itemtable = suitData.itemtable ?? {}
    const equipformulatable = suitData.equipformulatable ?? {}

    // Get suit name from equipsuittable
    const suitName = suitData.equipsuittable?.list?.[0]?.suitName?.text ?? file.replace('.json', '')

    // Skip test/manual/placeholder entries
    if (/test|测试|手动|debug|placeholder/i.test(suitName)) continue

    // Build outcomeEquipId → material name mapping
    const equipMaterialMap = new Map<string, string>()
    for (const formula of Object.values(equipformulatable)) {
      if (!formula.outcomeEquipId || !formula.costItemId?.length) continue
      const materialId = formula.costItemId[0]
      const materialItem = itemtable[materialId]
      if (materialItem?.name?.text) {
        equipMaterialMap.set(formula.outcomeEquipId, materialItem.name.text)
      }
    }

    // Process each equip
    for (const [equipId, equipData] of Object.entries(equiptable)) {
      if (!newEquipIds.includes(equipId)) continue

      // Get equip name from itemtable
      const equipItem = itemtable[equipId]
      if (!equipItem?.name?.text) continue

      const equipName = equipItem.name.text
      const material = equipMaterialMap.get(equipId) ?? ''

      // Extract sub stats from displayAttrModifiers
      let sub1 = ''
      let sub2 = ''
      let special = ''

      for (const mod of equipData.displayAttrModifiers ?? []) {
        if (Number(mod.attrIndex) === 0) continue // Skip main stat (防御力)

        const attrInfo = attrTypeMap.get(Number(mod.attrType))
        if (!attrInfo) continue

        const key = equipMapping.resolve(attrInfo.name)
        const statStr = formatEquipStat(key, Number(mod.attrValue), attrInfo.showPercent)

        if (Number(mod.attrIndex) === 1) sub1 = statStr
        else if (Number(mod.attrIndex) === 2) sub2 = statStr
        else if (Number(mod.attrIndex) === 3) special = statStr
      }

      // Add to EQUIP_ID_MAP
      newIdMapEntries.push(`  '${equipName}': '${equipId}'`)

      // Add to RAW_EQUIPS (with set info for grouped insertion)
      newRawEquipEntries.push({
        set: suitName,
        line: `  { name: '${equipName}', set: '${suitName}', rarity: 5, type: '${PART_TYPE_MAP[equipData.partType] ?? '配件'}', sub1: '${sub1}', sub2: '${sub2}', special: '${special}', material: '${material}' }`,
      })
    }
  }

  if (newIdMapEntries.length === 0) return 0

  // Update EQUIP_ID_MAP
  let updatedContent = insertEntries(content, 'const EQUIP_ID_MAP: Record<string, string> = {', newIdMapEntries)

  // Update RAW_EQUIPS (grouped by set)
  updatedContent = insertRawEquipsBySet(updatedContent, newRawEquipEntries)

  writeFileSync(equipsTsPath, updatedContent, 'utf-8')
  return newIdMapEntries.length
}

// ── Update dungeons.ts ────────────────────────────────────────────────────

export function updateDungeonsFile(
  dungeonsTsPath: string,
  newDungeonIds: string[],
  akedataPath: string,
  translationPath: string,
): number {
  if (newDungeonIds.length === 0) return 0

  const content = readFileSync(dungeonsTsPath, 'utf-8')
  const textTables = loadTextTable(translationPath, 'zh-CN')

  // Load group table
  const groupTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointGroupTable.json')
  const groupTable = existsSync(groupTablePath)
    ? parseJsonSafe(groupTablePath)
    : {}

  // Load level table for sub-region names
  const levelTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointTable.json')
  const levelTable = existsSync(levelTablePath)
    ? parseJsonSafe(levelTablePath)
    : {}

  const newDungeons: string[] = []
  for (const groupId of newDungeonIds) {
    const gData = (groupTable as Record<string, unknown>)[groupId] as Record<string, unknown> | undefined
    if (!gData) continue

    // Get level-1 name text ID for sub-region
    let nameTextId = ''
    for (const [, lData] of Object.entries(levelTable as Record<string, unknown>)) {
      if ((lData as Record<string, unknown>).gameGroupId === groupId) {
        const gameName = (lData as Record<string, unknown>).gameName as Record<string, unknown> | undefined
        if (gameName?.id) {
          nameTextId = String(gameName.id)
          break
        }
      }
    }

    // Get full level name from TextTable and extract sub-region part
    const fullName = textTables[nameTextId] ?? groupId
    // Split by '·' to get sub-region name (e.g., "重度能量淤积点·藏剑谷" → "藏剑谷")
    const dotIdx = fullName.indexOf('·')
    const subRegionName = dotIdx !== -1 ? fullName.slice(dotIdx + 1) : fullName
    // Use placeholder for region name (user must fill manually)
    const dungeonName = `<待填写>·${subRegionName}`

    // Convert gemTermIds directly (data file uses gemTermId keys)
    const primAttrTermIds = (gData.primAttrTermIds ?? []) as string[]
    const secAttrTermIds = (gData.secAttrTermIds ?? []) as string[]
    const skillTermIds = (gData.skillTermIds ?? []) as string[]

    const s1Pool = primAttrTermIds
    const s2Pool = secAttrTermIds
    const s3Pool = skillTermIds

    const dungeonEntry = `  {
    id: '${groupId}',
    name: '${dungeonName}',
    s1Pool: [${s1Pool.map(t => `'${t}'`).join(', ')}],
    s2Pool: [${s2Pool.map(t => `'${t}'`).join(', ')}],
    s3Pool: [${s3Pool.map(t => `'${t}'`).join(', ')}],
  }`
    newDungeons.push(dungeonEntry)
  }

  if (newDungeons.length === 0) return 0

  const updatedContent = insertEntries(content, 'export const dungeons: Dungeon[] = [', newDungeons)
  writeFileSync(dungeonsTsPath, updatedContent, 'utf-8')
  return newDungeons.length
}

// ── Update stat-i18n-map.ts ───────────────────────────────────────────────

export function updateStatI18nMap(
  statI18nMapPath: string,
  akedataPath: string,
  translationPath: string,
): number {
  const content = readFileSync(statI18nMapPath, 'utf-8')
  const textTables = loadTextTable(translationPath, 'zh-CN')

  const gemTablePath = join(akedataPath, 'TableCfg', 'GemTable.json')
  if (!existsSync(gemTablePath)) return 0
  const gemTable = parseJsonSafe(gemTablePath) as Record<string, Record<string, unknown>>

  // Build existing mappings
  const existingMappings = new Set<string>()
  const mappingRe = /'([^']+)':\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = mappingRe.exec(content)) !== null) {
    existingMappings.add(`${m[1]}:${m[2]}`)
  }

  // Find new gem terms
  const newMappings: string[] = []
  for (const [gemTermId, gemData] of Object.entries(gemTable)) {
    const tagName = gemData.tagName as Record<string, unknown> | undefined
    if (!tagName?.id) continue

    const cnName = textTables[String(tagName.id)]
    if (!cnName) continue

    const mappingKey = `${cnName}:${gemTermId}`
    if (!existingMappings.has(mappingKey)) {
      newMappings.push(`  '${cnName}': '${gemTermId}'`)
    }
  }

  if (newMappings.length === 0) return 0

  const updatedContent = insertEntries(content, 'export const STAT_TO_GEM_TERM: Record<string, string> = {', newMappings)
  writeFileSync(statI18nMapPath, updatedContent, 'utf-8')
  return newMappings.length
}
