import { create } from 'zustand'
import type { Equip, SlotRecommendation } from '@/types/refinement'
import {
  equips,
  equipById,
  setNames,
} from '@/data/equips'
import { buildRecommendations } from '@/lib/refinement/solver'

// ─── State ──────────────────────────────────────────────────────────────────

interface RefinementState {
  // Selection
  selectedEquipId: string | null

  // Set collapse: default all collapsed (true)
  collapsedSets: Record<string, boolean>

  // Search
  searchQuery: string

  // Left-side attribute filters (by stat name)
  filterSub1: string[]
  filterSub2: string[]
  filterSpecial: string[]

  // Filter panel collapsed
  filterCollapsed: boolean

  // Right-side material filter
  filterMaterial: string[]

  // Recommendation section expands (keyed by slotKey)
  expandedRecommendations: Record<string, boolean>

  // Actions
  selectEquip: (id: string | null) => void
  toggleSetCollapsed: (setName: string) => void
  setSearchQuery: (q: string) => void
  toggleFilter: (
    group: 'sub1' | 'sub2' | 'special' | 'material',
    value: string,
  ) => void
  clearFilters: () => void
  toggleFilterCollapsed: () => void
  toggleRecommendationExpand: (slotKey: string) => void
}

export const useRefinementStore = create<RefinementState>((set, get) => ({
  selectedEquipId: null,
  collapsedSets: Object.fromEntries(setNames.map((n) => [n, true])),
  searchQuery: '',
  filterSub1: [],
  filterSub2: [],
  filterSpecial: [],
  filterCollapsed: true,
  filterMaterial: [],
  expandedRecommendations: {},

  selectEquip: (id: string | null) => {
    const current = get().selectedEquipId
    // Deselect if same equip clicked
    if (id === current) {
      set({ selectedEquipId: null })
      return
    }
    set({ selectedEquipId: id })
  },

  toggleSetCollapsed: (setName: string) => {
    set((s) => ({
      collapsedSets: {
        ...s.collapsedSets,
        [setName]: !s.collapsedSets[setName],
      },
    }))
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q })
  },

  toggleFilter: (group, value) => {
    set((s) => {
      const key =
        group === 'sub1'
          ? 'filterSub1'
          : group === 'sub2'
            ? 'filterSub2'
            : group === 'special'
              ? 'filterSpecial'
              : 'filterMaterial'
      const current = s[key] as string[]
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { [key]: next } as Partial<RefinementState>
    })
  },

  clearFilters: () => {
    set({ filterSub1: [], filterSub2: [], filterSpecial: [] })
  },

  toggleFilterCollapsed: () => {
    set((s) => ({ filterCollapsed: !s.filterCollapsed }))
  },

  toggleRecommendationExpand: (slotKey: string) => {
    set((s) => ({
      expandedRecommendations: {
        ...s.expandedRecommendations,
        [slotKey]: !s.expandedRecommendations[slotKey],
      },
    }))
  },
}))

// ─── Derived selectors ──────────────────────────────────────────────────────

/** Get the selected equip, or null */
export function useSelectedEquip(): Equip | null {
  const id = useRefinementStore((s) => s.selectedEquipId)
  if (!id) return null
  return equipById.get(id) ?? null
}

/** Get filtered and searched equip list */
export function useFilteredEquips(): Equip[] {
  const query = useRefinementStore((s) => s.searchQuery)
  const sub1 = useRefinementStore((s) => s.filterSub1)
  const sub2 = useRefinementStore((s) => s.filterSub2)
  const special = useRefinementStore((s) => s.filterSpecial)

  if (!query && sub1.length === 0 && sub2.length === 0 && special.length === 0) {
    return equips
  }

  return equips.filter((e) => {
    // Search: match name or type
    if (query) {
      const q = query.toLowerCase()
      if (
        !e.name.toLowerCase().includes(q) &&
        !e.type.includes(q) &&
        !e.setName.toLowerCase().includes(q)
      ) {
        return false
      }
    }

    // Sub1 stat filter
    if (sub1.length > 0) {
      if (!e.sub1 || !sub1.includes(e.sub1.stat)) return false
    }

    // Sub2 stat filter
    if (sub2.length > 0) {
      if (!e.sub2 || !sub2.includes(e.sub2.stat)) return false
    }

    // Special stat filter
    if (special.length > 0) {
      if (!e.special || !special.includes(e.special.stat)) return false
    }

    return true
  })
}

/** Get equips grouped by set (respects filters and search) */
export function useGroupedSets(): { setName: string; equips: Equip[] }[] {
  const filtered = useFilteredEquips()
  const groups: { setName: string; equips: Equip[] }[] = []
  const seen = new Set<string>()

  // Preserve set order from the original setNames list
  for (const setName of setNames) {
    const setEquips = filtered.filter((e) => e.setName === setName)
    if (setEquips.length > 0) {
      groups.push({ setName, equips: setEquips })
      seen.add(setName)
    }
  }

  return groups
}

/** Get recommendations for the selected equip */
export function useRecommendations(): SlotRecommendation[] {
  const selected = useSelectedEquip()
  const materialFilter = useRefinementStore((s) => s.filterMaterial)

  if (!selected) return []

  return buildRecommendations(selected, materialFilter)
}
