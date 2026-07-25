// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { normalizePersistedGrowthConfigs, useGrowthPlannerStore } from './useGrowthPlannerStore'

const characterId = Object.keys(plannerGameData.characters)[0]
const weaponId = Object.keys(plannerGameData.weapons)[0]

describe('useGrowthPlannerStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useGrowthPlannerStore.setState({ configs: [] })
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
    const config = useGrowthPlannerStore.getState().configs[0]
    if (config.kind !== 'character') throw new Error('Expected migrated character config')

    expect(config.currentSkillLevels[2]).toBe(3)
    expect(config.currentSkillLevels[3]).toBe(7)
    expect(config.targetSkillLevels[2]).toBe(4)
    expect(config.targetSkillLevels[3]).toBe(9)
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
