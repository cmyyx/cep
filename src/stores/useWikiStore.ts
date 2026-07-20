import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WikiState {
  expandedEquipmentGroups: string[]
  toggleEquipmentGroup: (key: string) => void
}

export const useWikiStore = create<WikiState>()(
  persist(
    (set) => ({
      expandedEquipmentGroups: [],
      toggleEquipmentGroup: (key) =>
        set((state) => ({
          expandedEquipmentGroups: state.expandedEquipmentGroups.includes(key)
            ? state.expandedEquipmentGroups.filter((value) => value !== key)
            : [...state.expandedEquipmentGroups, key],
        })),
    }),
    {
      name: 'wiki-session',
      partialize: (state) => ({
        expandedEquipmentGroups: state.expandedEquipmentGroups,
      }),
    }
  )
)
