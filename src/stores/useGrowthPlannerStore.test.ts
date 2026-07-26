// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { createDefaultGrowthConfig } from '@/lib/planner/progression'
import { loadPlannerData } from '@/lib/planner/planner-data-loader'
import { normalizePersistedGrowthConfigs, REMOVED_CONFIG_CACHE_LIMIT, useGrowthPlannerStore } from './useGrowthPlannerStore'

// Progression/store helpers read planner data from the loader cache; prime it
// up front the same way the gated pages do.
await loadPlannerData()

const characterId = Object.keys(plannerGameData.characters)[0]
const weaponId = Object.keys(plannerGameData.weapons)[0]

describe('useGrowthPlannerStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useGrowthPlannerStore.setState({ configs: [], removedConfigs: [] })
  })

  it('adds each entity once', () => {
    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.addEntity('character', characterId)
    store.addEntity('weapon', weaponId)

    expect(useGrowthPlannerStore.getState().configs).toHaveLength(2)
  })

  it('normalizes current and target values when updating a config', () => {
    useGrowthPlannerStore.getState().addEntity('character', characterId)
    useGrowthPlannerStore.getState().updateConfig(characterId, { currentLevel: 70, targetLevel: 20 })

    const config = useGrowthPlannerStore.getState().configs[0]
    expect(config.currentLevel).toBe(70)
    expect(config.targetLevel).toBe(70)
  })

  it('hydrates legacy configs with current defaults and drops unknown fields', () => {
    const migrated = normalizePersistedGrowthConfigs([{
      kind: 'character',
      id: characterId,
      currentLevel: 30,
      targetLevel: 80,
      targetTalentCount: 4,
      obsoleteField: true,
    }])
    const config = migrated[0]
    if (config.kind !== 'character') throw new Error('Expected migrated character config')

    expect(config.currentLevel).toBe(30)
    expect(config.currentTalentIds).toEqual([])
    expect(config.targetTalentIds).toEqual(plannerGameData.characters[characterId].talents.map((node) => node.id))
    expect(config.currentAttributeNodeIds).toEqual([])
    expect(config.currentEquipmentNodeIds).toEqual([])
    expect(config.currentLogisticsNodeIds).toEqual([])
    expect('targetTalentCount' in config).toBe(false)
    expect('obsoleteField' in config).toBe(false)
  })

  it('migrates v1 skill level order when rehydrating growth planner storage', async () => {
    const character = plannerGameData.characters[characterId]
    const skillCount = character.skills.length
    if (skillCount < 4) throw new Error('Expected at least 4 character skills for migration test')
    const legacyCurrent = character.skills.map((_, index) => index + 1)
    const legacyTarget = character.skills.map((skill) => skill.maxLevel)
    // Simulate pre-fix order: index 2 ultimate, index 3 combo
    legacyCurrent[2] = 7
    legacyCurrent[3] = 3
    legacyTarget[2] = 9
    legacyTarget[3] = 4

    localStorage.setItem('growthPlanner', JSON.stringify({
      state: {
        configs: [{
          kind: 'character',
          id: characterId,
          currentLevel: 10,
          targetLevel: 80,
          currentBreakStage: 0,
          targetBreakStage: 4,
          currentSkillLevels: legacyCurrent,
          targetSkillLevels: legacyTarget,
        }],
      },
      version: 1,
    }))

    await useGrowthPlannerStore.persist.rehydrate()
    useGrowthPlannerStore.getState().pruneInvalid()
    const config = useGrowthPlannerStore.getState().configs[0]
    if (config.kind !== 'character') throw new Error('Expected migrated character config')

    expect(config.currentSkillLevels[2]).toBe(3)
    expect(config.currentSkillLevels[3]).toBe(7)
    expect(config.targetSkillLevels[2]).toBe(4)
    expect(config.targetSkillLevels[3]).toBe(9)
  })

  it('removes targets and moves the whole selection into the restore cache on clear', () => {
    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.addEntity('weapon', weaponId)
    store.removeEntity(characterId)
    expect(useGrowthPlannerStore.getState().configs.map((config) => config.id)).toEqual([weaponId])
    expect(useGrowthPlannerStore.getState().removedConfigs.map((config) => config.id)).toEqual([characterId])

    useGrowthPlannerStore.getState().clear()
    expect(useGrowthPlannerStore.getState().configs).toEqual([])
    expect(useGrowthPlannerStore.getState().removedConfigs.map((config) => config.id)).toEqual([characterId, weaponId])
  })

  it('restores a cleared config when the entity is re-added', () => {
    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.updateConfig(characterId, { currentLevel: 37, currentBreakStage: 1 })
    store.clear()
    expect(useGrowthPlannerStore.getState().configs).toEqual([])

    useGrowthPlannerStore.getState().addEntity('character', characterId)
    const config = useGrowthPlannerStore.getState().configs[0]
    expect(config.currentLevel).toBe(37)
    expect(config.currentBreakStage).toBe(1)
  })

  it('clear is a no-op when nothing is selected and never duplicates cache entries', () => {
    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.removeEntity(characterId)
    const cached = useGrowthPlannerStore.getState().removedConfigs

    useGrowthPlannerStore.getState().clear()
    expect(useGrowthPlannerStore.getState().removedConfigs).toBe(cached)

    store.addEntity('character', characterId)
    useGrowthPlannerStore.getState().clear()
    expect(useGrowthPlannerStore.getState().removedConfigs.map((config) => config.id)).toEqual([characterId])
  })

  it('honours the cache limit when clearing a large selection', () => {
    const filler = Array.from({ length: REMOVED_CONFIG_CACHE_LIMIT }, (_, index) => createDefaultGrowthConfig('weapon', `filler-${index}`))
    useGrowthPlannerStore.setState({ removedConfigs: filler })
    useGrowthPlannerStore.getState().addEntity('character', characterId)
    useGrowthPlannerStore.getState().addEntity('weapon', weaponId)

    useGrowthPlannerStore.getState().clear()
    const cachedIds = useGrowthPlannerStore.getState().removedConfigs.map((config) => config.id)
    expect(cachedIds).toHaveLength(REMOVED_CONFIG_CACHE_LIMIT)
    expect(cachedIds).not.toContain('filler-0')
    expect(cachedIds).not.toContain('filler-1')
    expect(cachedIds.slice(-2)).toEqual([characterId, weaponId])
  })

  it('restores the previous configuration when re-adding a removed entity', () => {
    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.updateConfig(characterId, { currentLevel: 42, currentBreakStage: 2 })
    store.removeEntity(characterId)
    expect(useGrowthPlannerStore.getState().configs).toEqual([])

    store.addEntity('character', characterId)
    const config = useGrowthPlannerStore.getState().configs[0]
    expect(config.currentLevel).toBe(42)
    expect(config.currentBreakStage).toBe(2)
    expect(useGrowthPlannerStore.getState().removedConfigs).toEqual([])
  })

  it('creates a default config when the removed-config cache misses', () => {
    useGrowthPlannerStore.getState().addEntity('weapon', weaponId)
    expect(useGrowthPlannerStore.getState().configs[0]).toEqual(createDefaultGrowthConfig('weapon', weaponId))
  })

  it('evicts the oldest cached config beyond the cache limit', () => {
    const filler = Array.from({ length: REMOVED_CONFIG_CACHE_LIMIT }, (_, index) => createDefaultGrowthConfig('weapon', `filler-${index}`))
    useGrowthPlannerStore.setState({ removedConfigs: filler })

    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.removeEntity(characterId)

    const cachedIds = useGrowthPlannerStore.getState().removedConfigs.map((config) => config.id)
    expect(cachedIds).toHaveLength(REMOVED_CONFIG_CACHE_LIMIT)
    expect(cachedIds).not.toContain('filler-0')
    expect(cachedIds.at(-1)).toBe(characterId)
  })

  it('persists the removed-config cache and restores it after rehydration', async () => {
    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.updateConfig(characterId, { currentLevel: 55 })
    store.removeEntity(characterId)

    const persistedRaw = localStorage.getItem('growthPlanner') ?? '{}'
    const persisted = JSON.parse(persistedRaw) as { state?: { removedConfigs?: Array<{ id: string }> } }
    expect(persisted.state?.removedConfigs?.map((config) => config.id)).toEqual([characterId])

    useGrowthPlannerStore.setState({ configs: [], removedConfigs: [] })
    localStorage.setItem('growthPlanner', persistedRaw)
    await useGrowthPlannerStore.persist.rehydrate()
    useGrowthPlannerStore.getState().pruneInvalid()
    useGrowthPlannerStore.getState().addEntity('character', characterId)
    expect(useGrowthPlannerStore.getState().configs[0].currentLevel).toBe(55)
  })

  it('drops invalid and duplicate cache entries once pruned after rehydrating', async () => {
    const active = createDefaultGrowthConfig('character', characterId)
    localStorage.setItem('growthPlanner', JSON.stringify({
      state: {
        configs: [active],
        removedConfigs: [active, createDefaultGrowthConfig('weapon', weaponId), { kind: 'weapon', id: 'missing-entity' }],
      },
      version: 2,
    }))

    await useGrowthPlannerStore.persist.rehydrate()
    useGrowthPlannerStore.getState().pruneInvalid()
    expect(useGrowthPlannerStore.getState().removedConfigs.map((config) => config.id)).toEqual([weaponId])
  })
})
