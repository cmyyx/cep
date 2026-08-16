import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WikiState {
  expandedEquipmentGroups: string[]
  /**
   * False until the user explicitly expands/collapses something. While false the
   * equipment list applies its first-visit defaults (top suits open) instead of the
   * empty stored list, so the first screen is never 25 rows of collapsed text.
   */
  hasStoredExpansion: boolean
  /** Collapsible entity-type groups (e.g. weapon types on the wiki weapons page). */
  expandedTypeGroups: string[]
  hasStoredTypeExpansion: boolean
  toggleEquipmentGroup: (key: string) => void
  setExpandedEquipmentGroups: (keys: readonly string[]) => void
  /** Back to first-visit behaviour (used by the local-data cleaner). */
  resetEquipmentGroups: () => void
  toggleTypeGroup: (key: string) => void
  setExpandedTypeGroups: (keys: readonly string[]) => void
  resetTypeGroups: () => void
}

export const useWikiStore = create<WikiState>()(
  persist(
    (set) => ({
      expandedEquipmentGroups: [],
      hasStoredExpansion: false,
      expandedTypeGroups: [],
      hasStoredTypeExpansion: false,
      toggleEquipmentGroup: (key) =>
        set((state) => ({
          hasStoredExpansion: true,
          expandedEquipmentGroups: state.expandedEquipmentGroups.includes(key)
            ? state.expandedEquipmentGroups.filter((value) => value !== key)
            : [...state.expandedEquipmentGroups, key],
        })),
      setExpandedEquipmentGroups: (keys) =>
        set({ hasStoredExpansion: true, expandedEquipmentGroups: [...keys] }),
      resetEquipmentGroups: () =>
        set({ hasStoredExpansion: false, expandedEquipmentGroups: [] }),
      toggleTypeGroup: (key) =>
        set((state) => ({
          hasStoredTypeExpansion: true,
          expandedTypeGroups: state.expandedTypeGroups.includes(key)
            ? state.expandedTypeGroups.filter((value) => value !== key)
            : [...state.expandedTypeGroups, key],
        })),
      setExpandedTypeGroups: (keys) =>
        set({ hasStoredTypeExpansion: true, expandedTypeGroups: [...keys] }),
      resetTypeGroups: () =>
        set({ hasStoredTypeExpansion: false, expandedTypeGroups: [] }),
    }),
    {
      name: 'wiki-session',
      partialize: (state) => ({
        expandedEquipmentGroups: state.expandedEquipmentGroups,
        hasStoredExpansion: state.hasStoredExpansion,
        expandedTypeGroups: state.expandedTypeGroups,
        hasStoredTypeExpansion: state.hasStoredTypeExpansion,
      }),
    }
  )
)
