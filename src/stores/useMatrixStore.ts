import { create } from 'zustand'
import { weapons } from '@/data/weapons'
import { dungeons } from '@/data/dungeons'
import { solve, type DungeonPlan } from '@/lib/planner/essence-solver'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a Set of weapon IDs to a sorted, stable array. */
function toSortedArray(set: Set<string>): string[] {
  return Array.from(set).sort()
}

/** Stable plan key: dungeon.id + lockType + lockValue. */
export function getPlanKey(plan: DungeonPlan): string {
  return `${plan.dungeon.id}-${plan.lockType}-${plan.lockValue}`
}

/**
 * Value comparison of two DungeonPlans.
 * Returns true when the plan is semantically unchanged — same weapons,
 * same selectedCount, same order of matchedWeapons, same effective s1.
 * Used to reuse previous plan object references and avoid unnecessary
 * re-renders of DungeonCard (React.memo + stable ref = skip).
 */
function isSamePlan(a: DungeonPlan, b: DungeonPlan): boolean {
  if (a.selectedCount !== b.selectedCount) return false
  if (a.totalCount !== b.totalCount) return false
  if (a.needsS1Choice !== b.needsS1Choice) return false
  if (a.matchedWeapons.length !== b.matchedWeapons.length) return false

  for (let i = 0; i < a.matchedWeapons.length; i++) {
    const am = a.matchedWeapons[i]
    const bm = b.matchedWeapons[i]
    if (am.weapon.id !== bm.weapon.id) return false
    if (am.isSelected !== bm.isSelected) return false
  }

  if (a.selectedS1.length !== b.selectedS1.length) return false
  for (let i = 0; i < a.selectedS1.length; i++) {
    if (a.selectedS1[i] !== b.selectedS1[i]) return false
  }

  if (a.s1Candidates.length !== b.s1Candidates.length) return false
  for (let i = 0; i < a.s1Candidates.length; i++) {
    if (a.s1Candidates[i] !== b.s1Candidates[i]) return false
  }

  const aKeys = Object.keys(a.s1CandidateCounts)
  const bKeys = Object.keys(b.s1CandidateCounts)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a.s1CandidateCounts[key] !== b.s1CandidateCounts[key]) return false
  }

  return true
}

/**
 * Build a reference-stable plan map from the solver output.
 *
 * For each new plan, if a plan with the same key already exists in
 * `prevMap` AND `isSamePlan` returns true, we reuse the old reference.
 */
function buildPlanMap(
  newPlans: DungeonPlan[],
  prevMap: Record<string, DungeonPlan>,
): { plansMap: Record<string, DungeonPlan>; planOrder: string[] } {
  const plansMap: Record<string, DungeonPlan> = {}
  const planOrder: string[] = []

  for (const plan of newPlans) {
    const key = getPlanKey(plan)
    planOrder.push(key)
    const prev = prevMap[key]
    if (prev && isSamePlan(prev, plan)) {
      plansMap[key] = prev
    } else {
      plansMap[key] = plan
    }
  }

  return { plansMap, planOrder }
}

/**
 * Compute dungeon plans for a given weapon selection.
 * (Exported for testing.)
 */
export function getPlansForSelection(ids: Set<string>): DungeonPlan[] {
  if (ids.size === 0) return []
  const allPlans = solve(ids, weapons, dungeons).dungeonPlans
  return allPlans.filter((p) => p.selectedCount > 0)
}

// ─── rAF-coalesced plan computation ─────────────────────────────────────

/** Whether a plan recomputation is already scheduled for the next frame. */
let plansPending = false
/** rAF handle for deferred plan computation. */
let rafId: number | undefined

/**
 * Schedule a plan recomputation on the next animation frame.
 * Repeated calls within the same frame coalesce into a single
 * computation using the latest selectedWeaponIds.
 */
function schedulePlansUpdate(
  set: (partial: Partial<MatrixState>) => void,
  get: () => MatrixState,
) {
  if (plansPending) return // already scheduled — will pick up latest ids
  plansPending = true
  rafId = requestAnimationFrame(() => {
    plansPending = false
    rafId = undefined
    const ids = new Set(get().selectedWeaponIds)
    if (ids.size === 0) {
      set({ plansMap: {}, planOrder: [], plansStale: false })
      return
    }
    const newPlans = getPlansForSelection(ids)
    const prevMap = get().plansMap
    const { plansMap, planOrder } = buildPlanMap(newPlans, prevMap)
    set({ plansMap, planOrder, plansStale: false })
  })
}

/** Cancel any pending rAF plan computation. */
function cancelPlansUpdate() {
  plansPending = false
  if (rafId !== undefined) {
    cancelAnimationFrame(rafId)
    rafId = undefined
  }
}

interface MatrixState {
  /** Sorted array of selected weapon ids. */
  selectedWeaponIds: string[]
  /** Plans keyed by stable planKey — updated asynchronously (rAF). */
  plansMap: Record<string, DungeonPlan>
  /** Sorted planKey order for deterministic rendering. */
  planOrder: string[]
  /** True while an rAF plan recomputation is pending. */
  plansStale: boolean
  expandedDungeonIds: string[]
  dungeonS1Selections: Record<string, string[]>

  toggleWeapon: (weaponId: string) => void
  selectAllWeapons: () => void
  clearWeapons: () => void
  toggleDungeonExpand: (planKey: string) => void
  setDungeonS1Selection: (planKey: string, s1: string[]) => void
}

export const useMatrixStore = create<MatrixState>((set, get) => ({
  selectedWeaponIds: [],
  plansMap: {},
  planOrder: [],
  plansStale: false,
  expandedDungeonIds: [],
  dungeonS1Selections: {},

  toggleWeapon: (weaponId: string) => {
    const current = get().selectedWeaponIds
    const nextSet = new Set(current)
    if (nextSet.has(weaponId)) {
      nextSet.delete(weaponId)
    } else {
      nextSet.add(weaponId)
    }
    const next = toSortedArray(nextSet)
    if (
      next.length === current.length &&
      next.every((id, i) => id === current[i])
    ) {
      return
    }
    // 1. Immediately show selection highlight on weapon cards
    // 2. Defer plan computation to next rAF (coalesces rapid clicks)
    set({ selectedWeaponIds: next, plansStale: true })
    schedulePlansUpdate(set, get)
  },

  selectAllWeapons: () => {
    const ids = toSortedArray(new Set(weapons.map((w) => w.id)))
    set({ selectedWeaponIds: ids, plansStale: true })
    schedulePlansUpdate(set, get)
  },

  clearWeapons: () => {
    if (get().selectedWeaponIds.length === 0) return
    cancelPlansUpdate()
    set({ selectedWeaponIds: [], plansMap: {}, planOrder: [], plansStale: false })
  },

  toggleDungeonExpand: (planKey: string) => {
    const current = get().expandedDungeonIds
    const nextSet = new Set(current)
    if (nextSet.has(planKey)) {
      nextSet.delete(planKey)
    } else {
      nextSet.add(planKey)
    }
    set({ expandedDungeonIds: Array.from(nextSet) })
  },

  setDungeonS1Selection: (planKey: string, s1: string[]) => {
    set((state) => ({
      dungeonS1Selections: { ...state.dungeonS1Selections, [planKey]: s1 },
    }))
  },
}))
