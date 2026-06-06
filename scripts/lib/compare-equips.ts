// Compares AKEData equipment (≥ 5★) against project equips.
// Equipment data is nested inside suit JSON files in output/CN/equip/.
// ================================================================================

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractItemNameIds } from './extract-textid'

export interface EquipEntry {
  equipId: string
  name: string
  suitId: string
  suitName: string
  rarity: number
  slot: string          // 部位: body/hand/edc/unknown
  primaryStat: string   // 主词条
  iconPath: string
  isNew: boolean
}

export interface EquipCompareResult {
  entries: EquipEntry[]
  newCount: number
  i18nEntries: { id: string; textId: string }[]
}

export function compareEquips(
  akedataPath: string,
  projectEquipsTsPath: string,
  imagedbPath?: string,
): EquipCompareResult {
  // Primary source: AKEDatabase/public/CH/equip/ (always most up-to-date)
  // Fallback: AKEData/output/CN/equip/
  const primaryDir = imagedbPath ? join(imagedbPath, 'public', 'CH', 'equip') : null
  const fallbackDir = join(akedataPath, 'output', 'CN', 'equip')
  const equipDir = primaryDir && existsSync(primaryDir) ? primaryDir
    : existsSync(fallbackDir) ? fallbackDir
    : null
  if (!equipDir) {
    console.warn('  [equips] equip dir not found')
    return { entries: [], newCount: 0, i18nEntries: [] }
  }

  const projectIds = extractProjectEquipIds(projectEquipsTsPath)

  // Extract localized name text IDs from ItemTable.json
  const equipTextIds = extractItemNameIds(join(akedataPath, 'TableCfg', 'ItemTable.json'))

  const entries: EquipEntry[] = []
  const i18nEntries: { id: string; textId: string }[] = []
  let newCount = 0

  for (const file of readdirSync(equipDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue
    const suitData = JSON.parse(readFileSync(join(equipDir, file), 'utf-8'))
    const suitId: string = suitData.suitID ?? file.replace('.json', '')
    const suitName: string = suitData['套组名称'] ?? suitId
    // Filter out test/manual-edit entries
    if (suitName.includes('手动编辑') || suitName.includes('手动')) continue
    const equipMap = suitData.equip as Record<string, unknown> | undefined
    if (!equipMap) continue

    for (const [itemId, itemData] of Object.entries(equipMap)) {
      const item = itemData as Record<string, unknown>
      const rarity: number = item.rarity as number ?? 1
      if (rarity < 5) continue

      const name: string = (item.name as string) || (item['name'] as string) || itemId
      const slot: string = (item['部位'] as string) ?? '未知'
      const primaryStat: string = (item['主词条'] as Record<string, unknown>)?.desc as string ?? ''
      const iconPath: string = (item.icon as string) ?? ''

      const isNew = !projectIds.has(itemId)
      if (isNew) newCount++

      entries.push({ equipId: itemId, name, suitId, suitName, rarity, slot, primaryStat, iconPath, isNew })
      const nameTextId = equipTextIds[itemId] ?? ''
      i18nEntries.push({ id: itemId, textId: nameTextId })
    }
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
