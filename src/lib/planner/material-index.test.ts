import { describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { loadPlannerData } from './planner-data-loader'
import { calculateGrowthRequirements, createDefaultGrowthConfig } from './progression'
import { buildMaterialIndex, getMaterialIndex, resetMaterialIndexForTests, type MaterialConsumerEntry } from './material-index'

// Progression reads planner data from the loader cache; prime it up front
// the same way the gated pages do.
await loadPlannerData()
describe('buildMaterialIndex', () => {
  it('conserves totals: per-entity index entries exactly match the maxed config calculation', () => {
    const index = buildMaterialIndex(plannerGameData)

    const perEntity = (kind: 'character' | 'weapon', id: string): Array<[string, MaterialConsumerEntry]> => {
      const entries: Array<[string, MaterialConsumerEntry]> = []
      for (const [itemId, list] of index) {
        const entry = list.find((candidate) => candidate.kind === kind && candidate.id === id)
        if (entry) entries.push([itemId, entry])
      }
      return entries
    }

    const verify = (kind: 'character' | 'weapon', id: string) => {
      const result = calculateGrowthRequirements([createDefaultGrowthConfig(kind, id)])
      const expected = new Map<string, number>()
      const setIfPositive = (itemId: string, count: number) => {
        if (count > 0) expected.set(itemId, count)
      }
      setIfPositive('item_gold', result.gold)
      setIfPositive('item_expcard_stage1_high', result.stageOneExp)
      setIfPositive('item_expcard_stage2_high', result.stageTwoExp)
      setIfPositive('item_weapon_expcard_high', result.weaponExp)
      for (const material of result.materials) {
        expected.set(material.itemId, (expected.get(material.itemId) ?? 0) + material.count)
      }

      const entries = perEntity(kind, id)
      const actual = new Map<string, number>()
      for (const [itemId, entry] of entries) actual.set(itemId, entry.count)
      expect(actual.size).toBe(expected.size)
      for (const [itemId, count] of expected) {
        expect(actual.get(itemId), `${kind} ${id} item ${itemId}`).toBe(count)
      }
      // parts must sum to the entry total
      for (const [, entry] of entries) {
        const partsSum = entry.parts.reduce((sum, part) => sum + part.count, 0)
        expect(partsSum, `${kind} ${id} ${entry.id} parts`).toBe(entry.count)
      }
    }

    for (const id of Object.keys(plannerGameData.characters)) verify('character', id)
    for (const id of Object.keys(plannerGameData.weapons)) verify('weapon', id)
  })

  it('indexes gold and every EXP family for characters and weapons', () => {
    const index = buildMaterialIndex(plannerGameData)
    expect(index.has('item_gold')).toBe(true)
    expect(index.has('item_expcard_stage1_high')).toBe(true)
    expect(index.has('item_expcard_stage2_high')).toBe(true)
    expect(index.has('item_weapon_expcard_high')).toBe(true)

    // Every character consumes at least one material family beyond gold/exp.
    const goldEntries = index.get('item_gold')!
    expect(goldEntries.some((entry) => entry.kind === 'character')).toBe(true)
    expect(goldEntries.some((entry) => entry.kind === 'weapon')).toBe(true)
  })

  it('does not count the final level row (levels 1..max-1 only)', () => {
    const index = buildMaterialIndex(plannerGameData)
    const weaponId = Object.keys(plannerGameData.weapons)[0]
    const entry = index.get('item_gold')!.find((candidate) => candidate.id === weaponId)
    expect(entry).toBeDefined()
    expect(entry!.count).toBeGreaterThan(0)
  })

  it('getMaterialIndex caches and resetMaterialIndexForTests clears', () => {
    resetMaterialIndexForTests()
    const first = getMaterialIndex()
    const second = getMaterialIndex()
    expect(first).toBe(second)
    resetMaterialIndexForTests()
    expect(getMaterialIndex()).not.toBe(first)
  })
})
