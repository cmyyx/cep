// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { loadPlannerData } from '@/lib/planner/planner-data-loader'
import { createDefaultPanelPreviewConfig, createPanelEquipmentSelection, maxOutPanelPreviewConfig, normalizePersistedPanelConfig, usePanelPreviewStore } from './usePanelPreviewStore'

// Store helpers read planner data from the loader cache; prime it up front the
// same way the gated pages do.
await loadPlannerData()

const characterIds = Object.keys(plannerGameData.characters)
const weaponIds = Object.keys(plannerGameData.weapons)
const equipmentIds = Object.keys(plannerGameData.equipment)

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

  it('keeps the weapon and equipment when resetting to max', () => {
    const characterId = characterIds[0]
    const weaponId = weaponIds[0]
    const equipmentId = equipmentIds[0]
    const character = plannerGameData.characters[characterId]
    usePanelPreviewStore.getState().setCharacter(characterId)
    usePanelPreviewStore.getState().updateConfig({
      level: 1,
      attributeNodeCount: 0,
      potentialLevel: 0,
      weaponId,
      weaponLevel: 4,
      weaponSkillLevels: [1, 1, 1],
      armor: { equipmentId, statLevels: [0] },
    })
    usePanelPreviewStore.getState().reset()

    const config = usePanelPreviewStore.getState().config
    expect(config?.weaponId).toBe(weaponId)
    expect(config?.armor).toEqual(createPanelEquipmentSelection(equipmentId))
    expect(config?.level).toBe(character.levels.at(-1)?.level)
    expect(config?.attributeNodeCount).toBe(character.attributeNodes.length)
    expect(config?.weaponLevel).toBe(plannerGameData.weapons[weaponId].levels.at(-1)?.level)
    const weaponSkills = plannerGameData.weapons[weaponId].skills
    config?.weaponSkillLevels.forEach((level, index) => {
      const expected = weaponSkills[index]?.levels.at(-1)?.level
      if (expected !== undefined) expect(level).toBe(expected)
    })
  })

  it('maxOutPanelPreviewConfig leaves an empty build untouched apart from levels', () => {
    const characterId = characterIds[0]
    const empty = { ...createDefaultPanelPreviewConfig(characterId), level: 3, potentialLevel: 0 }
    expect(maxOutPanelPreviewConfig(empty)).toEqual(createDefaultPanelPreviewConfig(characterId))
  })

  it('clamps every persisted numeric field back into range', () => {
    const characterId = characterIds[0]
    const weaponId = weaponIds[0]
    const character = plannerGameData.characters[characterId]
    const weapon = plannerGameData.weapons[weaponId]
    const config = normalizePersistedPanelConfig({
      ...createDefaultPanelPreviewConfig(characterId),
      level: 9999,
      talentCount: -4,
      attributeNodeCount: 9999,
      potentialLevel: 99,
      skillLevels: character.skills.map(() => 9999),
      weaponId,
      weaponLevel: 9999,
      weaponSkillLevels: [0, 9999, Number.NaN],
    })

    expect(config?.level).toBe(character.levels.at(-1)?.level)
    expect(config?.talentCount).toBe(0)
    expect(config?.attributeNodeCount).toBe(character.attributeNodes.length)
    expect(config?.potentialLevel).toBe(character.potentials.at(-1)?.level ?? 0)
    expect(config?.skillLevels).toEqual(character.skills.map((skill) => skill.maxLevel))
    expect(config?.weaponLevel).toBe(weapon.levels.at(-1)?.level)
    expect(config?.weaponSkillLevels).toHaveLength(3)
    config?.weaponSkillLevels.forEach((level, index) => {
      const maxSkillLevel = weapon.skills[index]?.levels.at(-1)?.level ?? 9
      expect(level).toBeGreaterThanOrEqual(1)
      expect(level).toBeLessThanOrEqual(maxSkillLevel)
      expect(Number.isInteger(level)).toBe(true)
    })
  })

  it('rounds fractional persisted levels instead of keeping them', () => {
    const characterId = characterIds[0]
    const config = normalizePersistedPanelConfig({
      ...createDefaultPanelPreviewConfig(characterId),
      level: 59.5,
      attributeNodeCount: 1.4,
    })

    expect(config?.level).toBe(60)
    expect(config?.attributeNodeCount).toBe(1)
  })

  it('falls back to defaults for non-numeric persisted levels', () => {
    const characterId = characterIds[0]
    const defaults = createDefaultPanelPreviewConfig(characterId)
    const config = normalizePersistedPanelConfig({
      ...defaults,
      level: '80',
      talentCount: null,
      weaponLevel: 'max',
    })

    expect(config?.level).toBe(defaults.level)
    expect(config?.talentCount).toBe(defaults.talentCount)
    expect(config?.weaponLevel).toBe(defaults.weaponLevel)
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
    usePanelPreviewStore.getState().pruneInvalid()
    const config = usePanelPreviewStore.getState().config

    expect(config?.characterId).toBe(characterId)
    expect(config?.level).toBe(12)
    expect(config?.attributeNodeCount).toBe(1)
    expect(config?.potentialLevel).toBe(plannerGameData.characters[characterId].potentials.at(-1)?.level ?? 0)
    expect(config?.armor).toEqual(createPanelEquipmentSelection(null))
  })

  it('migrates v3 skill level order when rehydrating panel preview storage', async () => {
    const characterId = characterIds[0]
    const character = plannerGameData.characters[characterId]
    if (character.skills.length < 4) throw new Error('Expected at least 4 character skills for migration test')
    const skillLevels = character.skills.map((skill) => skill.maxLevel)
    skillLevels[2] = 8
    skillLevels[3] = 2

    localStorage.setItem('panelPreview', JSON.stringify({
      state: {
        config: {
          ...createDefaultPanelPreviewConfig(characterId),
          skillLevels,
        },
      },
      version: 3,
    }))

    await usePanelPreviewStore.persist.rehydrate()
    usePanelPreviewStore.getState().pruneInvalid()
    const config = usePanelPreviewStore.getState().config

    expect(config?.skillLevels[2]).toBe(2)
    expect(config?.skillLevels[3]).toBe(8)
  })

})
