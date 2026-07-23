import { beforeEach, describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { normalizePersistedGrowthConfigs, useGrowthPlannerStore } from './useGrowthPlannerStore'

const characterId = Object.keys(plannerGameData.characters)[0]
const weaponId = Object.keys(plannerGameData.weapons)[0]

describe('useGrowthPlannerStore', () => {
  beforeEach(() => useGrowthPlannerStore.setState({ configs: [] }))

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

  it('removes targets and clears the planner', () => {
    const store = useGrowthPlannerStore.getState()
    store.addEntity('character', characterId)
    store.addEntity('weapon', weaponId)
    store.removeEntity(characterId)
    expect(useGrowthPlannerStore.getState().configs.map((config) => config.id)).toEqual([weaponId])

    useGrowthPlannerStore.getState().clear()
    expect(useGrowthPlannerStore.getState().configs).toEqual([])
  })
})
