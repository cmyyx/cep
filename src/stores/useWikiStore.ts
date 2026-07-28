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
  toggleEquipmentGroup: (key: string) => void
  setExpandedEquipmentGroups: (keys: readonly string[]) => void
  /** Back to first-visit behaviour (used by the local-data cleaner). */
  resetEquipmentGroups: () => void
}

export const useWikiStore = create<WikiState>()(
  persist(
    (set) => ({
      expandedEquipmentGroups: [],
      hasStoredExpansion: false,
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
    }),
    {
      name: 'wiki-session',
      partialize: (state) => ({
        expandedEquipmentGroups: state.expandedEquipmentGroups,
        hasStoredExpansion: state.hasStoredExpansion,
      }),
    }
  )
)
