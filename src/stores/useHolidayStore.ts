import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface HolidayState {
  dismissedHolidays: Record<string, number>
  holidayEffectsEnabled: boolean
  dismissHoliday: (id: string, year: number) => void
  toggleHolidayEffects: () => void
}

export const useHolidayStore = create<HolidayState>()(
  persist(
    (set) => ({
      dismissedHolidays: {},
      holidayEffectsEnabled: true,

      dismissHoliday: (id: string, year: number) =>
        set((s) => ({
          dismissedHolidays: { ...s.dismissedHolidays, [id]: year },
        })),

      toggleHolidayEffects: () =>
        set((s) => ({ holidayEffectsEnabled: !s.holidayEffectsEnabled })),
    }),
    {
      name: 'cep-holiday',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        dismissedHolidays: state.dismissedHolidays,
        holidayEffectsEnabled: state.holidayEffectsEnabled,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<HolidayState>
        return {
          ...current,
          dismissedHolidays:
            raw.dismissedHolidays &&
            typeof raw.dismissedHolidays === 'object' &&
            !Array.isArray(raw.dismissedHolidays)
              ? raw.dismissedHolidays
              : current.dismissedHolidays,
          holidayEffectsEnabled:
            typeof raw.holidayEffectsEnabled === 'boolean'
              ? raw.holidayEffectsEnabled
              : current.holidayEffectsEnabled,
        }
      },
    }
  )
)
