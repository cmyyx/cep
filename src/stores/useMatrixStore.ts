import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sanitizeWeaponIdArray, getActiveCustomWeaponIds } from '@/lib/persist-sanitizer'
import { useEssenceSettingsStore } from '@/stores/useEssenceSettingsStore'
import { weapons } from '@/data/weapons'
import { resolveWeaponId } from '@/lib/resolve-weapon-id'
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

// ─── Per-account weapon selection ───────────────────────────────────────────
// 选择集仍然存在本 store 的扁平 selectedWeaponIds（所有既有读者、导出、云同步
// 均不变）；当「分隔不同账号已选的武器」开启时，它代表当前账号的选择，权威副本
// 按账号存在 essence store 的 accounts[].selectedWeaponIds 里（跟随导入/导出/
// 云同步一起走）。

/**
 * Record the current selection on one account.
 *
 * No-op for an unknown account id (账号刚被删除/替换时不能回退到别的账号)
 * and while the separation switch is off.
 */
export function storeAccountSelection(accountId: string, ids: readonly string[]): void {
  const settings = useEssenceSettingsStore.getState()
  if (!settings.separateSelectionPerAccount) return
  settings.setAccountSelection(accountId, ids)
}

/** Resolve one account's stored selection against the current weapon dataset. */
function loadAccountSelection(accountId: string): string[] {
  const account = useEssenceSettingsStore.getState().accounts.find((a) => a.id === accountId)
  const stored = account?.selectedWeaponIds ?? []
  return sanitizeWeaponIdArray(stored, getActiveCustomWeaponIds())
}

/**
 * Move the in-memory selection from one account to another: the outgoing
 * account keeps what the user just had, the incoming one gets its own list.
 * Exported for tests (the live path is the store subscription below).
 */
export function swapAccountSelection(prevAccountId: string, nextAccountId: string): void {
  if (prevAccountId === nextAccountId) return
  storeAccountSelection(prevAccountId, useMatrixStore.getState().selectedWeaponIds)
  const next = loadAccountSelection(nextAccountId)
  cancelPlansUpdate()
  useMatrixStore.setState({ selectedWeaponIds: next, plansStale: true })
  schedulePlansUpdate(useMatrixStore.setState, useMatrixStore.getState)
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
  const customWeapons = useEssenceSettingsStore.getState().customWeapons
  const allWeapons = [...weapons, ...customWeapons]
  // Drop IDs that no longer map to any weapon (e.g. deleted custom weapons).
  // This also protects against stale IDs that slip past the persist sanitizer.
  const validIds = new Set(allWeapons.map(w => w.id))
  const cleanIds = new Set([...ids].filter(id => validIds.has(id)))
  if (cleanIds.size === 0) return []
  const allPlans = solve(cleanIds, allWeapons, dungeons).dungeonPlans
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
  expandedPlanKeys: string[]
  dungeonS1Selections: Record<string, string[]>
  /** Region filter — selected region names (array for JSON serialization). */
  selectedRegions: string[]
  /** Region filter — selected sub-region names. */
  selectedSubRegions: string[]
  /** Shared weapon search query (lifted from WeaponGrid). */
  weaponSearchQuery: string
  /** Shared weapon attr filters (serializable Record<string, string[]>). */
  weaponAttrFilters: Record<string, string[]>
  /** Current visible weapon IDs (written by WeaponGrid, read by select-all). */
  visibleWeaponIds: string[]

  toggleWeapon: (weaponId: string) => void
  selectAllWeapons: (ids?: string[]) => void
  clearWeapons: () => void
  toggleDungeonExpand: (planKey: string) => void
  setDungeonS1Selection: (planKey: string, s1: string[]) => void
  setSelectedRegions: (regions: string[]) => void
  setSelectedSubRegions: (subs: string[]) => void
  setWeaponSearchQuery: (q: string) => void
  setWeaponAttrFilters: (filters: Record<string, string[]>) => void
  setVisibleWeaponIds: (ids: string[]) => void
  /** Synchronously recompute plans (used on rehydration / fallback). */
  computePlans: () => void
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      selectedWeaponIds: [],
      plansMap: {},
      planOrder: [],
      plansStale: false,
      expandedPlanKeys: [],
      dungeonS1Selections: {},
      selectedRegions: [],
      selectedSubRegions: [],
      weaponSearchQuery: '',
      weaponAttrFilters: {},
      visibleWeaponIds: [],

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

      selectAllWeapons: (ids?: string[]) => {
        const next = ids
          ? toSortedArray(new Set(ids))
          : toSortedArray(new Set(weapons.map((w) => w.id)))
        if (next.length === 0) return
        set({ selectedWeaponIds: next, plansStale: true })
        schedulePlansUpdate(set, get)
      },

      clearWeapons: () => {
        if (get().selectedWeaponIds.length === 0) return
        cancelPlansUpdate()
        set({ selectedWeaponIds: [], plansMap: {}, planOrder: [], plansStale: false })
      },

      toggleDungeonExpand: (planKey: string) => {
        const current = get().expandedPlanKeys
        const nextSet = new Set(current)
        if (nextSet.has(planKey)) {
          nextSet.delete(planKey)
        } else {
          nextSet.add(planKey)
        }
        set({ expandedPlanKeys: Array.from(nextSet) })
      },

      setDungeonS1Selection: (planKey: string, s1: string[]) => {
        set((state) => ({
          dungeonS1Selections: { ...state.dungeonS1Selections, [planKey]: s1 },
        }))
      },

      setSelectedRegions: (regions: string[]) => {
        set({ selectedRegions: regions })
      },

      setSelectedSubRegions: (subs: string[]) => {
        set({ selectedSubRegions: subs })
      },

      setWeaponSearchQuery: (q: string) => {
        set({ weaponSearchQuery: q })
      },

      setWeaponAttrFilters: (filters: Record<string, string[]>) => {
        set({ weaponAttrFilters: filters })
      },

      setVisibleWeaponIds: (ids: string[]) => {
        set({ visibleWeaponIds: ids })
      },

      computePlans: () => {
        const { selectedWeaponIds } = get()
        if (selectedWeaponIds.length === 0) {
          set({ plansMap: {}, planOrder: [], plansStale: false })
          return
        }
        cancelPlansUpdate()
        const ids = new Set(selectedWeaponIds)
        const newPlans = getPlansForSelection(ids)
        const prevMap = get().plansMap
        const { plansMap, planOrder } = buildPlanMap(newPlans, prevMap)
        set({ plansMap, planOrder, plansStale: false })
      },
    }),
    {
      name: 'matrix-session',
      merge: (persisted: unknown, current) => {
        const p = persisted as Record<string, unknown> | null
        if (!p) return current
        // Only keep keys that exist in the current state — unknown keys
        // from old schema versions are silently dropped.
        const result = { ...current }
        for (const key of Object.keys(current)) {
          if (key in (p as Record<string, unknown>)) {
            ;(result as Record<string, unknown>)[key] = (p as Record<string, unknown>)[key]
          }
        }
        // Resolve preview: IDs → current game IDs before sanitization.
        // After resolution, persist will write back the game IDs — no
        // migration table needed.
        const rawIds = Array.isArray(result.selectedWeaponIds)
          ? (result.selectedWeaponIds as string[])
          : []
        const resolvedIds = rawIds.map(resolveWeaponId)

        // Resolve S1 selections — values are weapon ID arrays
        if (result.dungeonS1Selections && typeof result.dungeonS1Selections === 'object') {
          const raw = result.dungeonS1Selections as Record<string, string[]>
          const resolved: Record<string, string[]> = {}
          for (const [key, ids] of Object.entries(raw)) {
            const safeIds: string[] = Array.isArray(ids)
              ? ids.filter((v): v is string => typeof v === 'string').map(resolveWeaponId)
              : []
            resolved[key] = safeIds
          }
          result.dungeonS1Selections = resolved
        }

        // Value-level sanitization: filter unknown weapon IDs, including
        // deleted custom weapons whose IDs still start with "custom-".
        const activeCustomIds = getActiveCustomWeaponIds()
        result.selectedWeaponIds = sanitizeWeaponIdArray(resolvedIds, activeCustomIds)
        return result
      },
      partialize: (state) => ({
        selectedWeaponIds: state.selectedWeaponIds,
        expandedPlanKeys: state.expandedPlanKeys,
        dungeonS1Selections: state.dungeonS1Selections,
        selectedRegions: state.selectedRegions,
        selectedSubRegions: state.selectedSubRegions,
      }),
      onRehydrateStorage: () => {
        return () => {
          // Recompute plans after rehydration if weapons were selected.
          // Called asynchronously (microtask) — may race with first React render,
          // but the page component's useEffect fallback covers the gap.
          if (useMatrixStore.getState().selectedWeaponIds.length > 0) {
            useMatrixStore.getState().computePlans()
          }
        }
      },
    },
  ),
)

// ── 按账号分隔选择集：切账号 → 回写旧账号 + 载入新账号 ──
// （用订阅而不是在 essence store 里回调，避免两个 store 循环依赖）
useEssenceSettingsStore.subscribe((state, prevState) => {
  try {
    if (!state.separateSelectionPerAccount) return
    // 开关刚打开：把眼前这份选择登记给当前账号，不清空。
    if (prevState.separateSelectionPerAccount !== state.separateSelectionPerAccount) {
      storeAccountSelection(state.activeAccountId, useMatrixStore.getState().selectedWeaponIds)
    }
    if (state.activeAccountId !== prevState.activeAccountId) {
      swapAccountSelection(prevState.activeAccountId, state.activeAccountId)
    }
  } catch {
    // 选择集隔离失败不应影响规划器主流程。
  }
})

// ── 选择集变化 → 记到当前账号（开关关闭时不维护，保持共享行为）──
useMatrixStore.subscribe((state, prevState) => {
  if (state.selectedWeaponIds === prevState.selectedWeaponIds) return
  try {
    storeAccountSelection(
      useEssenceSettingsStore.getState().activeAccountId,
      state.selectedWeaponIds,
    )
  } catch {
    // 同上。
  }
})

// ── Cross-store cleanup: when a custom weapon is deleted, remove its ID ──
// ── from selectedWeaponIds so stale IDs don't linger in the session.   ──
useEssenceSettingsStore.subscribe((state, prevState) => {
  try {
    const currCustom = state.customWeapons
    const prevCustom = prevState.customWeapons
    if (currCustom === prevCustom) return

    // Find custom weapon IDs that were removed
    const currIds = new Set(currCustom.map(w => w.id))
    const removedIds = prevCustom
      .filter(w => w.id.startsWith('custom-') && !currIds.has(w.id))
      .map(w => w.id)

    if (removedIds.length === 0) return

    const matrix = useMatrixStore.getState()
    const newSelection = matrix.selectedWeaponIds.filter(id => !removedIds.includes(id))
    if (newSelection.length === matrix.selectedWeaponIds.length) return // none were selected

    // Remove stale IDs and trigger recomputation
    useMatrixStore.setState({
      selectedWeaponIds: newSelection,
      plansStale: true,
    })
    // Fire-and-forget recompute so the UI updates without waiting for next user interaction
    schedulePlansUpdate(
      useMatrixStore.setState,
      useMatrixStore.getState,
    )
  } catch {
    // Silently ignore — the read-time filters in collectSyncData /
    // collectLocalData / syncStoresFromCloudPayload are the last line.
  }
})
