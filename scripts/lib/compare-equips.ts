// Compares AKEData equipment (>= 5star) against project equips.
// Equipment data is read from TableCfg (EquipTable + ItemTable + EquipSuitTable).
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'
import { buildAttrShowConfigs } from './equip-stat-format'
import { parseJsonSafe } from './json-utils'
import { loadTextTable } from './stat-mapping'

export interface EquipEntry {
  equipId: string
  name: string
  suitId: string
  suitName: string
  rarity: number
  slot: string          // body/hand/edc/unknown
  primaryStat: string   // primary attribute name
  iconPath: string
  isNew: boolean
}

export interface EquipCompareResult {
  entries: EquipEntry[]
  newCount: number
  i18nEntries: { id: string; textId: string }[]
}

const PART_TYPE_MAP: Record<number, string> = {
  0: 'body',
  1: 'hand',
  2: 'edc',
}

interface EquipTableEntry {
  partType?: number
  suitID?: string
  displayBaseAttrModifier?: {
    attrType?: number
  }
}

interface ItemTableEntry {
  name?: { id?: string | number }
  rarity?: number
  iconId?: string
}

interface EquipSuitEntry {
  list?: Array<{
    suitName?: { id?: string | number }
  }>
}

export function compareEquips(
  akedataPath: string,
  projectEquipsTsPath: string,
): EquipCompareResult {
  const equipTablePath = join(akedataPath, 'TableCfg', 'EquipTable.json')
  const itemTablePath = join(akedataPath, 'TableCfg', 'ItemTable.json')
  const suitTablePath = join(akedataPath, 'TableCfg', 'EquipSuitTable.json')

  if (!existsSync(equipTablePath) || !existsSync(itemTablePath)) {
    console.warn('  [equips] EquipTable or ItemTable not found')
    return { entries: [], newCount: 0, i18nEntries: [] }
  }

  const projectIds = extractProjectEquipIds(projectEquipsTsPath)

  // Extract localized name text IDs from ItemTable.json
  const equipTextIds = extractItemNameIds(itemTablePath)

  // Load full ItemTable for rarity + iconId
  const itemTable = parseJsonSafe(itemTablePath) as Record<string, ItemTableEntry>

  // Load EquipTable
  const equipTable = parseJsonSafe(equipTablePath) as Record<string, EquipTableEntry>

  // Load EquipSuitTable for suit names
  let suitTable: Record<string, EquipSuitEntry> = {}
  if (existsSync(suitTablePath)) {
    suitTable = parseJsonSafe(suitTablePath) as Record<string, EquipSuitEntry>
  }

  // Load CN TextTable for name resolution
  const cnTextTable = loadTextTable(akedataPath, 'zh-CN')

  // Build attrType -> CN name mapping for primaryStat
  const { attrTypeMap } = buildAttrShowConfigs(akedataPath)

  const entries: EquipEntry[] = []
  const i18nEntries: { id: string; textId: string }[] = []
  let newCount = 0

  for (const [equipId, equipData] of Object.entries(equipTable)) {
    const itemData = itemTable[equipId]
    if (!itemData) continue

    const rarity: number = Number(itemData.rarity ?? 1)
    if (rarity < 5) continue

    // Resolve equip display name via ItemTable.name.id -> CN TextTable
    const nameTextId = equipTextIds[equipId] ?? ''
    const name: string = nameTextId ? (cnTextTable[nameTextId] ?? equipId) : equipId

    // Resolve suit name
    const suitID: string = String(equipData.suitID ?? '')
    let suitName = ''
    if (suitID && suitTable[suitID]) {
      const suitListEntry = suitTable[suitID].list?.[0]
      if (suitListEntry?.suitName?.id) {
        const suitNameTextId = String(suitListEntry.suitName.id)
        suitName = cnTextTable[suitNameTextId] ?? suitID
      }
    }
    if (!suitName) suitName = suitID

    // Resolve slot from partType
    const partType: number = Number(equipData.partType ?? -1)
    const slot: string = PART_TYPE_MAP[partType] ?? 'unknown'

    // Resolve primaryStat from displayBaseAttrModifier.attrType
    const attrType = Number(equipData.displayBaseAttrModifier?.attrType ?? 0)
    let primaryStat = ''
    if (attrType !== 0) {
      const attrCfg = attrTypeMap.get(attrType)
      primaryStat = attrCfg?.name ?? ''
    }

    // Get iconPath from ItemTable
    const iconPath: string = String(itemData.iconId ?? equipId)

    const isNew = !projectIds.has(equipId)
    if (isNew) newCount++

    entries.push({ equipId, name, suitId: suitID, suitName, rarity, slot, primaryStat, iconPath, isNew })
    i18nEntries.push({ id: equipId, textId: nameTextId })
  }

  return { entries, newCount, i18nEntries }
}

function extractProjectEquipIds(tsPath: string): Set<string> {
  if (!existsSync(tsPath)) return new Set()
  const content = readFileSync(tsPath, 'utf-8')
  const ids = new Set<string>()
  // Extract equipId from RAW_EQUIPS entries: equipId: 'item_equip_xxx'
  const equipIdRe = /equipId:\s*'(item_equip_[^']+)'/g
  let m: RegExpExecArray | null
  while ((m = equipIdRe.exec(content)) !== null) ids.add(m[1])
  return ids
}
