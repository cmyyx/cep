/**
 * Auto-update data source files (weapons.ts, equips.ts, dungeons.ts, stat-i18n-map.ts)
 * when new entries are detected during sync.
 * ================================================================================
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseLossless } from 'lossless-json'
import { buildGemTableLookup, loadTextTable } from './stat-mapping'
import { resolveSuitName } from './upstream'
import { buildAttrShowConfigs, resolveFormat, formatEquipStat } from './equip-stat-format'

// ── Types ─────────────────────────────────────────────────────────────────

interface WeaponData {
  title: string
  rarity: number
  weapontype: number
  skilllist: { skillName: string; blackboard: { key: string; value: unknown }[] }[]
}

interface DisplayAttrModifier {
  attrIndex: number
  attrType: number
  attrValue: number
  modifierType?: number
  compositeAttr?: string
}

interface EquipFormula {
  costItemId: string[]
  costItemNum: number[]
  costGoldId: string
  costGoldNum: number
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
// (移除 buildAttrTypeMap 和 formatEquipStat —— 已统一到 ./equip-stat-format 共享模块)

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

  // Ensure trailing comma on last inserted entry when not at array end
  const tail = content.slice(lineEnd)
  const needComma = !/^\s*\]/.test(tail)

  return (
    content.slice(0, lineEnd) + '\n' +
    newEntries.join(',\n') + (needComma ? ',' : '') +
    tail
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
      // Insert after the last entry of this set.
      // Ensure trailing comma on last inserted entry when not at array end.
      const tail = result.slice(lastSetLineEnd)
      const needComma = !/^\s*\]/.test(tail)
      result =
        result.slice(0, lastSetLineEnd) + '\n' +
        lines.join(',\n') + (needComma ? ',' : '') +
        tail
    } else {
      // Set not found, insert before the closing bracket
      const newCloseIdx = findContainerEnd(result, declPattern)
      if (newCloseIdx !== -1) {
        let lastContentIdx = newCloseIdx - 1
        while (lastContentIdx >= 0 && /\s/.test(result[lastContentIdx])) lastContentIdx--
        let lineEnd = lastContentIdx + 1
        while (lineEnd < result.length && result[lineEnd] !== '\n') lineEnd++
        const tail = result.slice(lineEnd)
        const needComma = !/^\s*\]/.test(tail)
        result =
          result.slice(0, lineEnd) + '\n' +
          lines.join(',\n') + (needComma ? ',' : '') +
          tail
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
): number {
  if (newWeaponIds.length === 0) return 0

  const content = readFileSync(weaponsTsPath, 'utf-8')

  // Build GemTable CN→gemTermId for special ability resolution
  const { cnToGem } = buildGemTableLookup(akedataPath)

  // Load ItemTable for iconId resolution (game-side icon resource mapping)
  const itemTable = loadItemTable(akedataPath)

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
    const iconId = resolveWeaponIconId(itemTable, weaponId) ?? weaponId

    const weaponEntry = `  { id: '${weaponId}', iconId: '${iconId}', name: '${data.title}', rarity: ${data.rarity}, type: '${type}', primaryStat: '${primaryStat}', elementalDamage: '${elementalDamage}', specialAbility: '${specialAbility}', chars: [] }`
    newWeapons.push(weaponEntry)
  }

  if (newWeapons.length === 0) return 0

  const updatedContent = insertEntries(content, 'export const weapons: Weapon[] = [', newWeapons)
  writeFileSync(weaponsTsPath, updatedContent, 'utf-8')
  return newWeapons.length
}

/**
 * Reconcile iconId field in weapons.ts with upstream ItemTable.iconId.
 *
 * 行级 patch：保留 chars、分组注释、preview 标记，仅同步 iconId 字段。
 * - 上游无此 weaponId → 跳过（不强制添加 iconId）
 * - 已有 iconId 且与上游一致 → 不变
 * - 已有 iconId 但与上游不一致 → 替换为上游值
 * - 没有 iconId → 紧跟 id 后插入
 *
 * @param dryRun true=只检测不修改，返回 issues；false=实际修复
 */
export function reconcileWeaponsIconIds(
  weaponsTsPath: string,
  akedataPath: string,
  dryRun = false,
): { added: number; updated: number; unchanged: number; skipped: number; issues: IconIdIssue[] } {
  const content = readFileSync(weaponsTsPath, 'utf-8')
  const itemTable = loadItemTable(akedataPath)

  const issues: IconIdIssue[] = []
  let added = 0, updated = 0, unchanged = 0, skipped = 0

  // 匹配每行 weapon entry（按 id: 'wpn_xxx' 锚定，单行 entry）
  // preview:xxx 跳过（无对应游戏数据）
  const lineRe = /^(\s*\{\s*)id:\s*'(wpn_[^']+)'([^}]*?)(\s*\},?\s*)$/gm

  const newContent = content.replace(lineRe, (full, prefix, weaponId, middle, suffix) => {
    const upstreamIconId = resolveWeaponIconId(itemTable, weaponId)
    if (!upstreamIconId) {
      // 上游无此 weaponId 的 iconId 数据，跳过
      skipped++
      return full
    }
    const expectedIconId = upstreamIconId

    const existingIconRe = /iconId:\s*'([^']+)'/
    const existingMatch = middle.match(existingIconRe)

    if (existingMatch) {
      const currentIconId = existingMatch[1]
      if (currentIconId === expectedIconId) {
        unchanged++
        return full
      }
      // 现有 iconId 与上游不一致
      issues.push({
        weaponId,
        type: 'mismatch',
        expected: expectedIconId,
        actual: currentIconId,
      })
      if (dryRun) return full
      updated++
      const newMiddle = middle.replace(existingIconRe, `iconId: '${expectedIconId}'`)
      return `${prefix}id: '${weaponId}'${newMiddle}${suffix}`
    }

    // 没有 iconId 字段
    issues.push({
      weaponId,
      type: 'missing',
      expected: expectedIconId,
      actual: '',
    })
    if (dryRun) return full
    added++
    return `${prefix}id: '${weaponId}', iconId: '${expectedIconId}'${middle}${suffix}`
  })

  if (!dryRun && (added > 0 || updated > 0)) {
    writeFileSync(weaponsTsPath, newContent, 'utf-8')
  }
  return { added, updated, unchanged, skipped, issues }
}

/** Load ItemTable.json from AKEData, returning a record of { id → { iconId } }.
 *  Only extracts iconId (string), so regex-based parsing avoids JSON.parse int64 precision issues.
 *  Throws when ItemTable.json is missing or unreadable — fail-closed to prevent
 *  sync:check false positives and sync:update persisting bad iconId data. */
function loadItemTable(akedataPath: string): Record<string, { iconId?: string }> {
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  if (!existsSync(itemTablePath)) {
    throw new Error(`ItemTable.json not found at ${itemTablePath} — cannot reconcile weapon iconId`)
  }
  const raw = readFileSync(itemTablePath, 'utf-8')
  const result: Record<string, { iconId?: string }> = {}
  const itemRe = /"(wpn_[^"]+)"\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(raw)) !== null) {
    const itemId = m[1]
    // 按对象边界精确切片，避免固定窗口泄漏到相邻 item（review r3482615236 / r3482640471）
    const objStart = raw.indexOf('{', m.index)
    const block = sliceTopLevelObject(raw, objStart)
    const iconIdMatch = block.match(/"iconId"\s*:\s*("(wpn_[^"]+)"|(wpn_\w+))/)
    if (iconIdMatch) {
      // 兼容字符串（"wpn_xxx"）或裸字面量（理论上 JSON 不会出现，但兼容）
      const iconId = iconIdMatch[2] ?? iconIdMatch[3]
      result[itemId] = { iconId }
    } else {
      result[itemId] = {}
    }
  }
  return result
}

/** Slice a top-level JSON object body starting at the position of its opening `{`.
 *  Tracks `{`/`}` depth to stop at the matching close brace. */
function sliceTopLevelObject(raw: string, start: number): string {
  let depth = 0
  let seenOpen = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') {
      depth++
      seenOpen = true
    } else if (ch === '}') {
      depth--
      if (seenOpen && depth === 0) return raw.slice(start, i + 1)
    }
  }
  // 格式异常（未闭合）→ 返回剩余内容，让后续 match 自行失败
  return raw.slice(start)
}

/** Resolve weapon iconId from ItemTable; returns undefined when upstream entry has no iconId field */
function resolveWeaponIconId(
  itemTable: Record<string, { iconId?: string }>,
  weaponId: string,
): string | undefined {
  return itemTable[weaponId]?.iconId
}

export interface IconIdIssue {
  weaponId: string
  type: 'missing' | 'mismatch'
  expected: string
  actual: string
}

// ── Update equips.ts ──────────────────────────────────────────────────────

export function updateEquipsFile(
  equipsTsPath: string,
  newEquipIds: string[],
  imagedbPath: string,
  akedataPath: string,
  reconcileAll?: boolean,
): number {
  const content = readFileSync(equipsTsPath, 'utf-8')
  const { attrTypeMap, compositeCfg } = buildAttrShowConfigs(akedataPath)

  // Build set of equipIds to process: all existing + new (when reconciling), or just new
  const targetIds = new Set<string>(newEquipIds)
  if (reconcileAll) {
    const existingRe = /equipId:\s*'(item_equip_[^']+)'/g
    let em: RegExpExecArray | null
    while ((em = existingRe.exec(content)) !== null) targetIds.add(em[1])
  }
  if (targetIds.size === 0) return 0

  // Use v2_equip data source
  const v2EquipDir = join(imagedbPath, 'public', 'CH', 'v2_equip')
  if (!existsSync(v2EquipDir)) return 0

  // Build a complete equipId → { line, set } map from upstream
  const upstreamEntries = new Map<string, { set: string; line: string }>()

  for (const file of readdirSync(v2EquipDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue

    const suitData = parseJsonSafe(join(v2EquipDir, file)) as V2EquipData
    const equiptable = suitData.equiptable ?? {}
    const itemtable = suitData.itemtable ?? {}
    const equipformulatable = suitData.equipformulatable ?? {}

    const suitName = resolveSuitName(file, imagedbPath)
    if (/test|测试|手动|debug|placeholder/i.test(suitName)) continue

    // Build outcomeEquipId → material name mapping
    const equipMaterialMap = new Map<string, string>()
    // Build outcomeEquipId → voucher info mapping
    const equipVoucherMap = new Map<string, { name: string; count: number }>()
    for (const formula of Object.values(equipformulatable)) {
      if (!formula.outcomeEquipId || !formula.costItemId?.length) continue
      const materialId = formula.costItemId[0]
      const materialItem = itemtable[materialId]
      if (materialItem?.name?.text) equipMaterialMap.set(formula.outcomeEquipId, materialItem.name.text)
      // Extract voucher from costGoldId / costGoldNum
      if (formula.costGoldId && formula.costGoldNum > 0) {
        const voucherItem = itemtable[formula.costGoldId]
        if (voucherItem?.name?.text) {
          equipVoucherMap.set(formula.outcomeEquipId, { name: voucherItem.name.text, count: formula.costGoldNum })
        }
      }
    }

    for (const [equipId, equipData] of Object.entries(equiptable)) {
      if (!targetIds.has(equipId)) continue

      const equipItem = itemtable[equipId]
      if (!equipItem?.name?.text) continue

      const equipName = equipItem.name.text.replace(/[\r\n]+/g, '').trim()
      const material = equipMaterialMap.get(equipId) ?? ''

      let sub1 = ''; let sub2 = ''; let special = ''
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
        if (Number(mod.attrIndex) === 1) sub1 = statStr
        else if (Number(mod.attrIndex) === 2) sub2 = statStr
        else if (Number(mod.attrIndex) === 3) special = statStr
      }

      const equipItemData = itemtable[equipId]
      const gameIconId = (equipItemData as Record<string, unknown>)?.iconId as string ?? ''
      const iconId = (gameIconId && gameIconId !== equipId) ? gameIconId : equipId

      const voucherInfo = equipVoucherMap.get(equipId)
      const voucher = voucherInfo ? `${voucherInfo.name}x${voucherInfo.count}` : ''

      upstreamEntries.set(equipId, {
        set: suitName,
        line: `  { name: '${equipName}', set: '${suitName}', rarity: 5, type: '${PART_TYPE_MAP[equipData.partType] ?? '配件'}', sub1: '${sub1}', sub2: '${sub2}', special: '${special}', material: '${material}', voucher: '${voucher}', equipId: '${equipId}', iconId: '${iconId}' }`,
      })
    }
  }

  if (upstreamEntries.size === 0) return 0

  if (reconcileAll) {
    // Full rewrite: replace entire RAW_EQUIPS array with upstream data
    return rewriteRawEquips(content, equipsTsPath, upstreamEntries)
  }

  // Insert-only mode: append new entries grouped by set
  const newEntries = [...upstreamEntries.values()]
  const updatedContent = insertRawEquipsBySet(content, newEntries)
  writeFileSync(equipsTsPath, updatedContent, 'utf-8')
  return newEntries.length
}

/** Replace the entire RAW_EQUIPS array in equips.ts with upstream data */
function rewriteRawEquips(
  content: string,
  equipsTsPath: string,
  upstreamEntries: Map<string, { set: string; line: string }>,
): number {
  // Determine line ending from the file
  const lineEnd = content.includes('\r\n') ? '\r\n' : '\n'
  const rawDecl = 'const RAW_EQUIPS: RawEquip[] = [' + lineEnd
  const rawStart = content.indexOf(rawDecl)
  if (rawStart === -1) return 0

  // The array content starts right after '[' + lineEnd in rawDecl
  const arrStart = rawStart + rawDecl.length

  // Find matching ']' — count nested arrays
  let depth = 0
  let arrClose = -1
  for (let i = arrStart; i < content.length; i++) {
    if (content[i] === '[') depth++
    if (content[i] === ']') {
      if (depth === 0) { arrClose = i; break }
      depth--
    }
  }
  if (arrClose === -1) return 0

  const tailContent = content.substring(arrClose + 1)
  const preContent = content.substring(0, rawStart)

  // Build new RAW_EQUIPS entirely from upstream
  const upstreamLines = [...upstreamEntries.values()].map(e => e.line)
  const newRawBlock = rawDecl + upstreamLines.join(',' + lineEnd) + lineEnd + ']'

  // Clean tail: remove leading ';' and whitespace
  const cleanTail = tailContent.replace(/^;\s*/, '').replace(/^\r?\n/, '')

  writeFileSync(equipsTsPath, preContent + newRawBlock + ';' + lineEnd + lineEnd + cleanTail, 'utf-8')
  return upstreamLines.length
}

// ── Update dungeons.ts ────────────────────────────────────────────────────

export function updateDungeonsFile(
  dungeonsTsPath: string,
  newDungeonIds: string[],
  akedataPath: string,
): number {
  if (newDungeonIds.length === 0) return 0

  const content = readFileSync(dungeonsTsPath, 'utf-8')
  const textTables = loadTextTable(akedataPath, 'zh-CN')

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
): number {
  const content = readFileSync(statI18nMapPath, 'utf-8')
  const textTables = loadTextTable(akedataPath, 'zh-CN')

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
