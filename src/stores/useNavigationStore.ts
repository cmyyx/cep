import { create } from 'zustand'

interface NavigationState {
  isNavigating: boolean
  targetLabel: string | null
  /** Timestamp used to correlate start/finish for the debounce timer. */
  navigateStartTime: number | null
  startNavigation: (label: string) => void
  finishNavigation: () => void
}

/**
 * Navigation loading overlay store.
 *
 * Uses a 200 ms debounce: the overlay is only shown when navigation
 * takes longer than the threshold. Fast page transitions never flash
 * the overlay.
 *
 * Fade-out is intentionally instant — the View Transitions API handles
 * the visual bridge from overlay to new page content.
 */
export const useNavigationStore = create<NavigationState>((set) => ({
  isNavigating: false,
  targetLabel: null,
  navigateStartTime: null,

  startNavigation: (label) => {
    const now = Date.now()
    set({ targetLabel: label, navigateStartTime: now })

    // Delay showing the overlay — if navigation finishes before
    // this fires the store state will no longer match and we skip.
    setTimeout(() => {
      const current = useNavigationStore.getState()
      if (current.navigateStartTime === now) {
        useNavigationStore.setState({ isNavigating: true })
      }
    }, 200)
  },

  finishNavigation: () => {
    // Keep targetLabel visible during the CSS opacity fade-out so the text
    // doesn't disappear before the spinner.
    set({ isNavigating: false, navigateStartTime: null })
  },
}))
