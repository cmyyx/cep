// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { createDefaultPanelPreviewConfig, createPanelEquipmentSelection, normalizePersistedPanelConfig, usePanelPreviewStore } from './usePanelPreviewStore'

const characterIds = Object.keys(plannerGameData.characters)

describe('usePanelPreviewStore', () => {
  beforeEach(() => {
    localStorage.clear()
    usePanelPreviewStore.setState({ config: null })
  })

  it('creates a fully upgraded default character configuration', () => {
    const characterId = characterIds[0]
    const character = plannerGameData.characters[characterId]
    const config = createDefaultPanelPreviewConfig(characterId)

    expect(config.level).toBe(character.levels.at(-1)?.level)
    expect(config.skillLevels).toEqual(character.skills.map((skill) => skill.maxLevel))
    expect(config.attributeNodeCount).toBe(character.attributeNodes.length)
    expect(config.potentialLevel).toBe(character.potentials.at(-1)?.level ?? 0)
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
    usePanelPreviewStore.getState().updateConfig({ level: 1, attributeNodeCount: 0, potentialLevel: 0 })
    usePanelPreviewStore.getState().reset()

    expect(usePanelPreviewStore.getState().config).toEqual(createDefaultPanelPreviewConfig(characterId))
  })

  it('drops an invalid persisted character and clears invalid equipment IDs', () => {
    expect(normalizePersistedPanelConfig({ characterId: 'missing' })).toBeNull()
    const characterId = characterIds[0]
    const config = normalizePersistedPanelConfig({
      ...createDefaultPanelPreviewConfig(characterId),
      potentialLevel: 99,
      armor: { equipmentId: 'missing', statLevels: [9] },
    })

    expect(config?.potentialLevel).toBe(plannerGameData.characters[characterId].potentials.at(-1)?.level ?? 0)
    expect(config?.armor).toEqual(createPanelEquipmentSelection(null))
  })


  it('migrates v2 persisted panel preview config through normalize', async () => {
    const characterId = characterIds[0]
    const defaults = createDefaultPanelPreviewConfig(characterId)
    localStorage.setItem('panelPreview', JSON.stringify({
      state: {
        config: {
          characterId,
          level: 12,
          skillLevels: defaults.skillLevels,
          talentCount: defaults.talentCount,
          attributeNodeCount: 1,
          weaponId: null,
          weaponLevel: 90,
          weaponSkillLevels: [9, 9, 9],
          armor: { equipmentId: 'missing', statLevels: [9] },
          gloves: createPanelEquipmentSelection(null),
          accessoryOne: createPanelEquipmentSelection(null),
          accessoryTwo: createPanelEquipmentSelection(null),
        },
      },
      version: 2,
    }))

    await usePanelPreviewStore.persist.rehydrate()
    const config = usePanelPreviewStore.getState().config

    expect(config?.characterId).toBe(characterId)
    expect(config?.level).toBe(12)
    expect(config?.attributeNodeCount).toBe(1)
    expect(config?.potentialLevel).toBe(plannerGameData.characters[characterId].potentials.at(-1)?.level ?? 0)
    expect(config?.armor).toEqual(createPanelEquipmentSelection(null))
  })

})
