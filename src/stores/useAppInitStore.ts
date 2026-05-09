import { create } from 'zustand'

export type InitPhase = 'splash' | 'tracking' | 'ready'

interface AppInitState {
  /** Current phase */
  phase: InitPhase
  /** Overall progress 0–100, driven by CSS animation + data sources */
  progress: number
  /** Tasks registered by data sources (e.g. 'announcements', 'version') */
  tasks: Set<string>
  completedTasks: Set<string>
  /** Set to true once init has fully completed in this session */
  hasCompleted: boolean

  /** Transition from splash to tracking phase */
  beginTracking: () => void
  /** Register a data-loading task (call BEFORE async work) */
  registerTask: (taskId: string) => void
  /** Complete a data-loading task */
  completeTask: (taskId: string) => void
  /** Bump progress by an absolute value (for byte-stream tracking) */
  setProgress: (value: number) => void
  /** Mark loading done → phase='ready', triggers exit animation */
  markReady: () => void
  /** Call AFTER the exit animation finishes to permanently hide the overlay */
  markCompleted: () => void
}

export const useAppInitStore = create<AppInitState>((set, get) => ({
  phase: 'splash',
  progress: 0,
  tasks: new Set(),
  completedTasks: new Set(),
  hasCompleted: false,

  beginTracking: () => {
    const { hasCompleted } = get()
    if (hasCompleted) return
    set({ phase: 'tracking', progress: 0 })
  },

  registerTask: (taskId) => {
    const { tasks } = get()
    const next = new Set(tasks)
    next.add(taskId)
    set({ tasks: next })
  },

  completeTask: (taskId) => {
    const { tasks, completedTasks } = get()
    const nextCompleted = new Set(completedTasks)
    nextCompleted.add(taskId)

    const allDone = [...tasks].every((t) => nextCompleted.has(t))
    set({
      completedTasks: nextCompleted,
      ...(allDone ? { progress: 90 } : {}),
    })
  },

  setProgress: (value) => {
    set({ progress: Math.max(get().progress, value) })
  },

  markReady: () => {
    set({ phase: 'ready', progress: 100 })
  },

  markCompleted: () => {
    set({ hasCompleted: true })
  },
}))
