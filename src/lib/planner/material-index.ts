/**
 * Reverse material index for the growth planner.
 *
 * For every character/weapon, computes the FULL max-level-up consumption
 * ("升满"): all levels, all promotions/breakthroughs, all skills to max,
 * all talents and attribute/equipment/logistics nodes — using the same
 * data walk as `calculateGrowthRequirements` with a maxed default config.
 *
 * The result maps itemId → consumers (kind + id + total count + per-category
 * breakdown). Gold and the three EXP-card families are indexed as regular
 * itemIds so the UI can treat every resource uniformly.
 */

import { getCachedPlannerGameData } from '@/lib/planner/planner-data-loader'
import { PLANNER_RESOURCE_IDS } from '@/lib/planner-resource-ids'
import type { PlannerGameData, PlannerMaterialTuple } from '@/types/planner'

export type MaterialCategory =
  | 'level'
  | 'breakthrough'
  | 'promotion'
  | 'skill'
  | 'talent'
  | 'attributeNode'
  | 'equipmentNode'
  | 'logisticsNode'

export interface MaterialConsumerPart {
  category: MaterialCategory
  count: number
}

export interface MaterialConsumerEntry {
  kind: 'character' | 'weapon'
  id: string
  /** Total consumption of this itemId by the entity (sum of parts). */
  count: number
  /** Consumption split by growth category (sorted, descending). */
  parts: MaterialConsumerPart[]
}

export type MaterialIndex = Map<string, MaterialConsumerEntry[]>

const { gold: GOLD_ID, stageOneExp: STAGE_ONE_EXP_ID, stageTwoExp: STAGE_TWO_EXP_ID, weaponExp: WEAPON_EXP_ID } = PLANNER_RESOURCE_IDS

const CATEGORY_ORDER: Record<MaterialCategory, number> = {
  level: 0,
  promotion: 1,
  breakthrough: 2,
  skill: 3,
  talent: 4,
  attributeNode: 5,
  equipmentNode: 6,
  logisticsNode: 7,
}

/**
 * Build the index from planner data. Deterministic; callers should memoize.
 * Exported for testing.
 */
export function buildMaterialIndex(gameData: PlannerGameData): MaterialIndex {
  const index: MaterialIndex = new Map()

  const add = (
    itemId: string,
    count: number,
    kind: 'character' | 'weapon',
    id: string,
    category: MaterialCategory,
  ): void => {
    if (count <= 0) return
    let entries = index.get(itemId)
    if (!entries) {
      entries = []
      index.set(itemId, entries)
    }
    let entry = entries.find((candidate) => candidate.kind === kind && candidate.id === id)
    if (!entry) {
      entry = { kind, id, count: 0, parts: [] }
      entries.push(entry)
    }
    entry.count += count
    let part = entry.parts.find((candidate) => candidate.category === category)
    if (!part) {
      part = { category, count: 0 }
      entry.parts.push(part)
    }
    part.count += count
  }

  const addTuples = (
    tuples: readonly PlannerMaterialTuple[],
    kind: 'character' | 'weapon',
    id: string,
    category: MaterialCategory,
  ): void => {
    for (const [itemId, count] of tuples) add(itemId, count, kind, id, category)
  }

  // ── Characters ──
  for (const [id, data] of Object.entries(gameData.characters)) {
    const maxLevel = data.levels.at(-1)?.level ?? 90
    // Levels 1..maxLevel-1 (mirrors calculateGrowthRequirements with current=1)
    for (const row of data.levels) {
      if (row.level >= maxLevel) continue
      const expId = row.level < 60 ? STAGE_ONE_EXP_ID : STAGE_TWO_EXP_ID
      add(expId, row.levelUpExp, 'character', id, 'level')
      add(GOLD_ID, row.levelUpGold, 'character', id, 'level')
    }
    for (const promotion of data.promotions) addTuples(promotion.materials, 'character', id, 'promotion')
    for (const skill of data.skills) {
      for (const level of skill.materialsByLevel) {
        if (level.level > 1 && level.level <= skill.maxLevel) addTuples(level.materials, 'character', id, 'skill')
      }
    }
    for (const node of data.talents) addTuples(node.materials, 'character', id, 'talent')
    for (const node of data.attributeNodes) addTuples(node.materials, 'character', id, 'attributeNode')
    for (const node of data.equipmentNodes) addTuples(node.materials, 'character', id, 'equipmentNode')
    for (const node of data.logisticsNodes) addTuples(node.materials, 'character', id, 'logisticsNode')
  }

  // ── Weapons ──
  for (const [id, data] of Object.entries(gameData.weapons)) {
    const maxLevel = data.levels.at(-1)?.level ?? 90
    for (const row of data.levels) {
      if (row.level >= maxLevel) continue
      add(WEAPON_EXP_ID, row.levelUpExp, 'weapon', id, 'level')
      add(GOLD_ID, row.levelUpGold, 'weapon', id, 'level')
    }
    for (const breakthrough of data.breakthroughs) addTuples(breakthrough.materials, 'weapon', id, 'breakthrough')
  }

  // Deterministic ordering: parts sorted by category order; consumers left in
  // data order (stable); the caller sorts by count for display.
  for (const entries of index.values()) {
    for (const entry of entries) {
      entry.parts.sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category])
    }
  }
  return index
}

// ── Module-level cache (planner data is static per build) ──

let cachedIndex: MaterialIndex | null = null

/** Read the cached index, building it lazily from loaded planner data. */
export function getMaterialIndex(): MaterialIndex {
  if (cachedIndex) return cachedIndex
  const gameData = getCachedPlannerGameData()
  if (!gameData) return new Map()
  cachedIndex = buildMaterialIndex(gameData)
  return cachedIndex
}

/** Test helper: drop the cached index. */
export function resetMaterialIndexForTests(): void {
  cachedIndex = null
}
