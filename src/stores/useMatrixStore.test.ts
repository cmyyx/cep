import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useMatrixStore, getPlansForSelection } from './useMatrixStore'

describe('useMatrixStore', () => {
  beforeEach(() => {
    // Make rAF fire synchronously so plan computation is instant in tests.
    // Use a controlled stub that accumulates IDs so we can verify
    // coalescing behaviour.
    let nextId = 1
    const callbacks = new Map<number, FrameRequestCallback>()

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        const id = nextId++
        callbacks.set(id, cb)
        // Fire synchronously for convenience in most tests
        cb(0)
        callbacks.delete(id)
        return id
      }),
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        callbacks.delete(id)
      }),
    )

    useMatrixStore.setState({
      selectedWeaponIds: [],
      plansMap: {},
      planOrder: [],
      plansStale: false,
      expandedPlanKeys: [],
      dungeonS1Selections: {},
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with empty selection', () => {
    const state = useMatrixStore.getState()
    expect(state.selectedWeaponIds).toHaveLength(0)
    expect(state.planOrder).toHaveLength(0)
    expect(state.plansStale).toBe(false)
  })

  it('toggleWeapon adds a weapon id and updates plans (sync rAF)', () => {
    useMatrixStore.getState().toggleWeapon('guzhou')
    const state = useMatrixStore.getState()
    expect(state.selectedWeaponIds).toContain('guzhou')
    expect(state.planOrder.length).toBeGreaterThan(0)
    expect(state.plansStale).toBe(false)
    for (const key of state.planOrder) {
      expect(state.plansMap[key]).toBeDefined()
    }
  })

  it('toggleWeapon removes a weapon id when already selected', () => {
    useMatrixStore.getState().toggleWeapon('guzhou')
    useMatrixStore.getState().toggleWeapon('guzhou')
    expect(useMatrixStore.getState().selectedWeaponIds).not.toContain('guzhou')
  })

  it('selectAllWeapons selects all weapons and computes plans', () => {
    useMatrixStore.getState().selectAllWeapons()
    const state = useMatrixStore.getState()
    expect(state.selectedWeaponIds.length).toBeGreaterThan(0)
    expect(state.planOrder.length).toBeGreaterThan(0)
  })

  it('clearWeapons removes all selections and clears plans', () => {
    useMatrixStore.getState().selectAllWeapons()
    useMatrixStore.getState().clearWeapons()
    const state = useMatrixStore.getState()
    expect(state.selectedWeaponIds).toHaveLength(0)
    expect(state.planOrder).toHaveLength(0)
    expect(state.plansStale).toBe(false)
  })

  it('toggleDungeonExpand toggles expansion state', () => {
    useMatrixStore.getState().toggleDungeonExpand('hub')
    expect(useMatrixStore.getState().expandedPlanKeys).toContain('hub')
    useMatrixStore.getState().toggleDungeonExpand('hub')
    expect(useMatrixStore.getState().expandedPlanKeys).not.toContain('hub')
  })

  it('getPlansForSelection returns empty for empty selection', () => {
    const plans = getPlansForSelection(new Set())
    expect(plans).toHaveLength(0)
  })

  it('getPlansForSelection returns plans for a selected weapon', () => {
    const plans = getPlansForSelection(new Set(['guzhou']))
    expect(plans.length).toBeGreaterThan(0)
    for (const plan of plans) {
      expect(plan.dungeon).toBeDefined()
      expect(plan.lockType).toMatch(/^s[23]$/)
      expect(Array.isArray(plan.matchedWeapons)).toBe(true)
      expect(plan.totalCount).toBeGreaterThanOrEqual(0)
    }
  })

  it('setDungeonS1Selection stores selection', () => {
    useMatrixStore
      .getState()
      .setDungeonS1Selection('test-key', ['力量提升', '敏捷提升'])
    expect(
      useMatrixStore.getState().dungeonS1Selections['test-key']
    ).toEqual(['力量提升', '敏捷提升'])
  })

  it('toggleWeapon reuses plan references when plan is unchanged', () => {
    // Select two weapons
    useMatrixStore.getState().toggleWeapon('guzhou')
    useMatrixStore.getState().toggleWeapon('luocao')

    // Capture references after two selections
    const stateBefore = useMatrixStore.getState()
    const refsBefore: Record<string, object> = {}
    for (const key of stateBefore.planOrder) {
      refsBefore[key] = stateBefore.plansMap[key]
    }

    // Toggle a third weapon — some plans will change, most should keep refs
    useMatrixStore.getState().toggleWeapon('wangxiang')
    const stateAfter = useMatrixStore.getState()

    let reusedCount = 0
    let newCount = 0
    for (const key of stateAfter.planOrder) {
      const before = refsBefore[key]
      const after = stateAfter.plansMap[key]
      if (before && before === after) {
        reusedCount++
      } else {
        newCount++
      }
    }

    // Most plans should be reused (only plans containing toggled weapons change)
    expect(reusedCount).toBeGreaterThan(0)
    expect(newCount).toBeGreaterThan(0)
    expect(reusedCount + newCount).toBe(stateAfter.planOrder.length)
  })
})
