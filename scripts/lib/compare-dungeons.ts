// Compares AKEData Energy Alluvium (/=) point data against project dungeons.
// Source: WorldEnergyPointGroupTable.json + WorldEnergyPointTable.json
// These are the gem farming nodes, NOT regular dungeons.
// ================================================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface DungeonEntry {
  dungeonId: string         // WorldEnergyPointGroupTable group ID
  name: string              // First level gameName from TextTable (CN)
  nameTextId: string        // TextTable ID for the display name
  regionName: string        // Extracted region portion (first part before separator)
  subRegion: string         // Extracted sub-region portion (second part)
  secAttrTermIds: string[]  // S2 pool
  skillTermIds: string[]    // S3 pool
  isNew: boolean
}

export interface DungeonCompareResult {
  entries: DungeonEntry[]
  groupIds: string[]
  newCount: number
}

export function compareDungeons(
  akedataPath: string,
  _projectDungeonsTsPath: string,
): DungeonCompareResult {
  const groupTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointGroupTable.json')
  const levelTablePath = join(akedataPath, 'TableCfg', 'WorldEnergyPointTable.json')

  if (!existsSync(groupTablePath)) {
    console.warn('  [dungeons] WorldEnergyPointGroupTable.json not found')
    return { entries: [], groupIds: [], newCount: 0 }
  }

  const groupTable = JSON.parse(readFileSync(groupTablePath, 'utf-8')) as Record<string, Record<string, unknown>>
  const levelTable = existsSync(levelTablePath)
    ? JSON.parse(readFileSync(levelTablePath, 'utf-8')) as Record<string, Record<string, unknown>>
    : {}

  // Build level-1 name mapping: groupId → first level's gameName.id
  const groupLevel1Name: Record<string, { textId: string; name: string }> = {}
  for (const [, lData] of Object.entries(levelTable)) {
    const gameGroupId = lData.gameGroupId as string
    const worldLevel = lData.worldLevel as number
    const gameName = lData.gameName as Record<string, unknown> | undefined
    const nameTextId = gameName?.id ? String(gameName.id) : ''
    if (!gameGroupId || !nameTextId || nameTextId === '0') continue
    if (worldLevel === 1 || !groupLevel1Name[gameGroupId]) {
      groupLevel1Name[gameGroupId] = { textId: nameTextId, name: '' }
    }
  }

  const entries: DungeonEntry[] = []
  const groupIds: string[] = []

  for (const [groupId, gData] of Object.entries(groupTable)) {
    const gameGroupName = gData.gameGroupName as Record<string, unknown> | undefined
    const nameTextId = gameGroupName?.id ? String(gameGroupName.id) : ''
    const secAttrTermIds = (gData.secAttrTermIds ?? []) as string[]
    const skillTermIds = (gData.skillTermIds ?? []) as string[]
    const level1Info = groupLevel1Name[groupId]

    // Use level-1 name text ID for display name (e.g. "Energy Alluvium: The Hub")
    const displayNameTextId = level1Info?.textId ?? nameTextId

    entries.push({
      dungeonId: groupId,
      name: '', // Resolved later via TextTable in the generate step
      nameTextId: displayNameTextId,
      regionName: '',
      subRegion: '',
      secAttrTermIds,
      skillTermIds,
      isNew: false,
    })
    groupIds.push(groupId)
  }

  return { entries, groupIds, newCount: 0 }
}
