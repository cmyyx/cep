import { create } from 'zustand'
import { weapons } from '@/data/weapons'
import { dungeons as allDungeons } from '@/data/dungeons'
import { solve, type DungeonPlan } from '@/lib/planner/essence-solver'

interface MatrixState {
  selectedWeaponIds: Set<string>
  dungeonPlans: DungeonPlan[]
  expandedDungeonIds: Set<string>
  dungeonS1Selections: Record<string, string[]>

  toggleWeapon: (weaponId: string) => void
  selectAllWeapons: () => void
  clearWeapons: () => void
  toggleDungeonExpand: (dungeonId: string) => void
  setDungeonS1Selection: (planKey: string, s1: string[]) => void
}

function getPlansForSelection(ids: Set<string>) {
  const allPlans = solve(ids, weapons, allDungeons).dungeonPlans
  if (ids.size === 0) return allPlans
  return allPlans.filter((p) => p.selectedCount > 0)
}

export const useMatrixStore = create<MatrixState>((set, get) => ({
  selectedWeaponIds: new Set<string>(),
  dungeonPlans: getPlansForSelection(new Set()),
  expandedDungeonIds: new Set<string>(),
  dungeonS1Selections: {},

  toggleWeapon: (weaponId: string) => {
    const next = new Set(get().selectedWeaponIds)
    if (next.has(weaponId)) {
      next.delete(weaponId)
    } else {
      next.add(weaponId)
    }
    set({
      selectedWeaponIds: next,
      dungeonPlans: getPlansForSelection(next),
    })
  },

  selectAllWeapons: () => {
    const ids = new Set(weapons.map((w) => w.id))
    set({
      selectedWeaponIds: ids,
      dungeonPlans: getPlansForSelection(ids),
    })
  },

  clearWeapons: () => {
    set({
      selectedWeaponIds: new Set(),
      dungeonPlans: getPlansForSelection(new Set()),
    })
  },

  toggleDungeonExpand: (dungeonId: string) => {
    const next = new Set(get().expandedDungeonIds)
    if (next.has(dungeonId)) {
      next.delete(dungeonId)
    } else {
      next.add(dungeonId)
    }
    set({ expandedDungeonIds: next })
  },

  setDungeonS1Selection: (planKey: string, s1: string[]) => {
    set((state) => ({
      dungeonS1Selections: { ...state.dungeonS1Selections, [planKey]: s1 },
    }))
  },
}))
