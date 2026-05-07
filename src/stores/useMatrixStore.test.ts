import { describe, it, expect, beforeEach } from 'vitest'
import { useMatrixStore } from './useMatrixStore'

describe('useMatrixStore', () => {
  beforeEach(() => {
    const store = useMatrixStore.getState()
    store.clearWeapons()
    useMatrixStore.setState({
      expandedDungeonIds: new Set<string>(),
      dungeonS1Selections: {},
    })
  })

  it('starts with empty selection', () => {
    const state = useMatrixStore.getState()
    expect(state.selectedWeaponIds.size).toBe(0)
  })

  it('toggleWeapon adds a weapon id', () => {
    useMatrixStore.getState().toggleWeapon('guzhou')
    expect(useMatrixStore.getState().selectedWeaponIds.has('guzhou')).toBe(true)
  })

  it('toggleWeapon removes a weapon id when already selected', () => {
    useMatrixStore.getState().toggleWeapon('guzhou')
    useMatrixStore.getState().toggleWeapon('guzhou')
    expect(useMatrixStore.getState().selectedWeaponIds.has('guzhou')).toBe(false)
  })

  it('selectAllWeapons selects all weapons', () => {
    useMatrixStore.getState().selectAllWeapons()
    const { selectedWeaponIds } = useMatrixStore.getState()
    expect(selectedWeaponIds.size).toBeGreaterThan(0)
  })

  it('clearWeapons removes all selections', () => {
    useMatrixStore.getState().selectAllWeapons()
    useMatrixStore.getState().clearWeapons()
    expect(useMatrixStore.getState().selectedWeaponIds.size).toBe(0)
  })

  it('toggleDungeonExpand toggles expansion state', () => {
    useMatrixStore.getState().toggleDungeonExpand('hub')
    expect(useMatrixStore.getState().expandedDungeonIds.has('hub')).toBe(true)
    useMatrixStore.getState().toggleDungeonExpand('hub')
    expect(useMatrixStore.getState().expandedDungeonIds.has('hub')).toBe(false)
  })

  it('dungeonPlans are generated on init', () => {
    const { dungeonPlans } = useMatrixStore.getState()
    expect(dungeonPlans.length).toBeGreaterThan(0)
  })

  it('dungeonPlans update when weapon is selected', () => {
    useMatrixStore.getState().toggleWeapon('guzhou')
    const after = useMatrixStore.getState().dungeonPlans
    // Plans structure should still be valid
    expect(after.length).toBeGreaterThan(0)
    for (const plan of after) {
      expect(plan.dungeon).toBeDefined()
      expect(plan.lockType).toMatch(/^s[23]$/)
      expect(Array.isArray(plan.matchedWeapons)).toBe(true)
      expect(plan.totalCount).toBeGreaterThanOrEqual(0)
    }
  })

  it('setDungeonS1Selection stores selection', () => {
    useMatrixStore.getState().setDungeonS1Selection('test-key', ['力量提升', '敏捷提升'])
    expect(useMatrixStore.getState().dungeonS1Selections['test-key']).toEqual(['力量提升', '敏捷提升'])
  })
})
