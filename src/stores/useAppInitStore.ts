import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { APP_INIT_STORAGE_KEY } from '@/lib/constants'

export type InitPhase = 'splash' | 'ready'

/**
 * Startup curtain state.
 *
 * The curtain reveals on hydration alone (see AppInitOverlay): it used to wait
 * for every registered data task — `/version.json` plus the announcement index
 * and all announcement markdown — which measured 300 ms past hydration on
 * Fast 3G and far more on slow links.
 *
 * The task registry (`tasks` / `completedTasks` / `registerTask` /
 * `completeTask`), the `progress` counter and the `'tracking'` phase were
 * removed together with that gate: nothing read them any more, `beginTracking()`
 * had no caller left (so `phase: 'tracking'` was unreachable, which in turn made
 * `use-version`'s first-fetch branch permanently false), and the progress bar
 * they fed was replaced by an indeterminate shimmer.
 */
interface AppInitState {
  /** 'splash' until the reveal starts, 'ready' while the exit animation runs. */
  phase: InitPhase
  /** Set to true once init has fully completed in this session */
  hasCompleted: boolean

  /** Mark loading done → phase='ready', triggers exit animation */
  markReady: () => void
  /** Call AFTER the exit animation finishes to permanently hide the overlay */
  markCompleted: () => void
}

export const useAppInitStore = create<AppInitState>()(
  persist(
    (set) => ({
      phase: 'splash',
      hasCompleted: false,

      markReady: () => {
        set({ phase: 'ready' })
      },

      markCompleted: () => {
        set({ hasCompleted: true })
      },
    }),
    {
      name: APP_INIT_STORAGE_KEY,
      // sessionStorage, not localStorage: a reload in the same tab should skip
      // the curtain, but a fresh tab is a fresh visit and should show it.
      storage: createJSONStorage(() => sessionStorage),
      // Only the completion flag is durable; the phase is per-load transient
      // state. `app-init-done-script.ts` reads exactly this envelope shape from
      // the same key, so the persisted shape must stay `{ state: { hasCompleted } }`.
      partialize: (state) => ({ hasCompleted: state.hasCompleted }),
    },
  ),
)
