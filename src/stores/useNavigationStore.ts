import { create } from 'zustand'

interface NavigationState {
  isNavigating: boolean
  isProgressing: boolean
  /** True while the completion animation (˜350ms) plays after navigation finishes. */
  isCompleting: boolean
  targetLabel: string | null
  /** Timestamp used to correlate start/finish for the debounce timer. */
  navigateStartTime: number | null
  startNavigation: (label: string) => void
  finishNavigation: () => void
  /** Called by the progress bar after its completion animation ends. */
  resetProgress: () => void
}

/**
 * Navigation loading store.
 *
 * Three feedback tiers:
 *   isProgressing  → progress bar appears immediately (0ms debounce)
 *   isNavigating   → full-area overlay (200ms debounce)
 *   isCompleting   → progress bar plays its "done" animation before resetting
 */
export const useNavigationStore = create<NavigationState>((set) => ({
  isNavigating: false,
  isProgressing: false,
  isCompleting: false,
  targetLabel: null,
  navigateStartTime: null,

  startNavigation: (label) => {
    const prev = useNavigationStore.getState()
    if (prev.navigateStartTime !== null) {
      useNavigationStore.setState({
        isNavigating: false,
        isProgressing: false,
        isCompleting: false,
        navigateStartTime: null,
      })
    }

    const now = Date.now()
    set({ targetLabel: label, navigateStartTime: now, isProgressing: true })

    // 200ms debounce for the full-area overlay.
    // Also checks isProgressing — if finishNavigation already fired
    // (fast navigation), skip so the overlay doesn't re-appear and get stuck.
    setTimeout(() => {
      const current = useNavigationStore.getState()
      if (current.navigateStartTime === now && current.isProgressing) {
        useNavigationStore.setState({ isNavigating: true })
      }
    }, 200)
  },

  finishNavigation: () => {
    // Transition from "progressing" to "completing" — the progress bar
    // plays its done animation, then calls resetProgress() to fully reset.
    set({ isProgressing: false, isCompleting: true, isNavigating: false })
  },

  resetProgress: () => {
    set({
      isCompleting: false,
      navigateStartTime: null,
      targetLabel: null,
    })
  },
}))
