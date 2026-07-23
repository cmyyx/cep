import { beforeEach, describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { createDefaultPanelPreviewConfig, createPanelEquipmentSelection, usePanelPreviewStore } from './usePanelPreviewStore'

const characterIds = Object.keys(plannerGameData.characters)

describe('usePanelPreviewStore', () => {
  beforeEach(() => usePanelPreviewStore.setState({ config: null }))

  it('creates a fully upgraded default character configuration', () => {
    const characterId = characterIds[0]
    const character = plannerGameData.characters[characterId]
    const config = createDefaultPanelPreviewConfig(characterId)

    expect(config.level).toBe(character.levels.at(-1)?.level)
    expect(config.skillLevels).toEqual(character.skills.map((skill) => skill.maxLevel))
    expect(config.attributeNodeCount).toBe(character.attributeNodes.length)
    expect(config.armor.statLevels).toEqual([])
  })

  it('defaults every selected equipment affix to its maximum level', () => {
    const equipmentId = Object.keys(plannerGameData.equipment)[0]
    const stats = plannerGameData.equipment[equipmentId]
    expect(createPanelEquipmentSelection(equipmentId).statLevels).toEqual(stats.map((stat) => stat.values.length - 1))
  })

  it('replaces the full configuration when the character changes', () => {
    usePanelPreviewStore.getState().setCharacter(characterIds[0])
    usePanelPreviewStore.getState().updateConfig({ level: 1 })
    usePanelPreviewStore.getState().setCharacter(characterIds[1])

    expect(usePanelPreviewStore.getState().config).toEqual(createDefaultPanelPreviewConfig(characterIds[1]))
  })

  it('resets the active character to full progress', () => {
    const characterId = characterIds[0]
    usePanelPreviewStore.getState().setCharacter(characterId)
    usePanelPreviewStore.getState().updateConfig({ level: 1, attributeNodeCount: 0 })
    usePanelPreviewStore.getState().reset()

    expect(usePanelPreviewStore.getState().config).toEqual(createDefaultPanelPreviewConfig(characterId))
  })
})
