import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useTranslations } from 'next-intl'
import { sanitizeEquipId } from '@/lib/persist-sanitizer'
import type { Equip, SlotRecommendation } from '@/types/refinement'
import {
  equips,
  equipById,
  setNames,
} from '@/data/equips'
import { buildRecommendations } from '@/lib/refinement/solver'

// ─── Persist / search helpers ───────────────────────────────────────────────

/** Drop corrupted persisted values; only boolean flags keyed by slotKey survive. */
export function sanitizeExpandedRecommendations(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, expanded]) => typeof expanded === 'boolean'),
  ) as Record<string, boolean>
}

/** zh-CN equip type literals → i18n key suffix (mirrors equip-card display labels). */
export const EQUIP_TYPE_KEYS: Record<string, string> = {
  '配件': 'edc',
  '护手': 'hand',
  '护甲': 'body',
}

export interface EquipSearchLabels {
  name?: string
  type?: string
  setName?: string
}

/**
 * Match the raw zh-CN data AND the localized strings shown on the card, so users on
 * en/ja/zh-TW can search for the names they actually see.
 */
export function matchesEquipQuery(
  equip: Pick<Equip, 'name' | 'type' | 'setName'>,
  query: string,
  localized: EquipSearchLabels = {},
): boolean {
  const term = query.trim().toLowerCase()
  if (!term) return true
  return [equip.name, equip.type, equip.setName, localized.name, localized.type, localized.setName]
    .some((value) => typeof value === 'string' && value.toLowerCase().includes(term))
}

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

/** User choices written to localStorage (computed data stays out). */
export function refinementPartialize(state: RefinementState) {
  return {
    selectedEquipId: state.selectedEquipId,
    collapsedSets: state.collapsedSets,
    filterCollapsed: state.filterCollapsed,
    // AGENTS.md: plan card expand/collapse state must survive a reload.
    expandedRecommendations: state.expandedRecommendations,
  }
}

export const useRefinementStore = create<RefinementState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'refinement-session',
      partialize: refinementPartialize,
      merge: (persisted, current) => {
        const p = persisted as Record<string, unknown> | null
        if (!p) return current
        // Only keep keys that exist in the current state
        const result = { ...current }
        for (const key of Object.keys(current)) {
          if (key in (p as Record<string, unknown>)) {
            ;(result as Record<string, unknown>)[key] = (p as Record<string, unknown>)[key]
          }
        }
        // Rebuild collapsedSets with current setNames, falling back to true for missing keys
        const mergedCollapsed: Record<string, boolean> = {}
        for (const name of setNames) {
          const persistedCollapsed = result.collapsedSets as Record<string, boolean> | undefined
          mergedCollapsed[name] =
            typeof persistedCollapsed?.[name] === 'boolean'
              ? persistedCollapsed[name]
              : true
        }
        result.selectedEquipId = sanitizeEquipId(
          typeof result.selectedEquipId === 'string' ? result.selectedEquipId : null
        )
        result.collapsedSets = mergedCollapsed
        result.filterCollapsed =
          typeof result.filterCollapsed === 'boolean' ? result.filterCollapsed : true
        result.expandedRecommendations = sanitizeExpandedRecommendations(result.expandedRecommendations)
        return result
      },
    },
  ),
)

// ─── Derived selectors ──────────────────────────────────────────────────────

/** Get the selected equip, or null */
export function useSelectedEquip(): Equip | null {
  const id = useRefinementStore((s) => s.selectedEquipId)
  if (!id) return null
  return equipById.get(id) ?? null
}

/** Get filtered and searched equip list */
export function useFilteredEquips(): Equip[] {
  const t = useTranslations()
  const query = useRefinementStore((s) => s.searchQuery)
  const sub1 = useRefinementStore((s) => s.filterSub1)
  const sub2 = useRefinementStore((s) => s.filterSub2)
  const special = useRefinementStore((s) => s.filterSpecial)

  if (!query && sub1.length === 0 && sub2.length === 0 && special.length === 0) {
    return equips
  }

  /** Localized labels as rendered by EquipCard / EquipSetGroup. */
  const localizedLabels = (equip: Equip): EquipSearchLabels => {
    const nameKey = `equips.${equip.id}`
    const typeKey = `equipTypes.${EQUIP_TYPE_KEYS[equip.type] ?? equip.type}`
    const setKey = `suits.${equip.setName.replace(/\./g, '')}`
    return {
      name: t.has(nameKey) ? t(nameKey) : undefined,
      type: t.has(typeKey) ? t(typeKey) : undefined,
      setName: t.has(setKey) ? t(setKey) : undefined,
    }
  }

  return equips.filter((e) => {
    // Search: raw zh-CN data + localized display strings
    if (query && !matchesEquipQuery(e, query, localizedLabels(e))) {
      return false
    }

    // Sub1 stat filter
    if (sub1.length > 0) {
      if (!e.sub1 || !sub1.includes(e.sub1.key)) return false
    }

    // Sub2 stat filter
    if (sub2.length > 0) {
      if (!e.sub2 || !sub2.includes(e.sub2.key)) return false
    }

    // Special stat filter
    if (special.length > 0) {
      if (!e.special || !special.includes(e.special.key)) return false
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
