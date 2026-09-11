import { create } from 'zustand'

/**
 * Global backend availability flag.
 *
 * The API client raises it whenever the backend answers with `maintenance_mode`
 * and lowers it as soon as any request gets a non-maintenance answer, so the
 * maintenance banner both appears and disappears without a page reload.
 */
interface SystemStatusState {
  maintenance: boolean
  reportMaintenance: () => void
  reportHealthy: () => void
}

export const useSystemStatusStore = create<SystemStatusState>()((set) => ({
  maintenance: false,
  reportMaintenance: () =>
    set((state) => (state.maintenance ? state : { maintenance: true })),
  reportHealthy: () =>
    set((state) => (state.maintenance ? { maintenance: false } : state)),
}))
