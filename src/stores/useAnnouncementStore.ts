import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Announcement } from '@/types/announcement'
import { useAppInitStore } from '@/stores/useAppInitStore'
import { MIN_LOADING_DISPLAY_MS } from '@/lib/constants'

const TASK_ID = 'announcements'

interface AnnouncementState {
  announcements: Announcement[]
  readIds: string[]
  isLoading: boolean
  loadError: boolean
  loadAnnouncements: () => Promise<void>
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

/**
 * Fetch JSON with byte-level progress reporting.
 * Falls back to a standard fetch if ReadableStream is unavailable or body is null.
 */
async function fetchJSONWithProgress<T>(
  url: string,
  onProgress: (pct: number) => void
): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const contentLength = Number(res.headers.get('Content-Length') || 0)
  const body = res.body

  // No streaming support — fall back
  if (!body || !contentLength) {
    onProgress(0.5)
    const data = await res.json()
    onProgress(1)
    return data as T
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(received / contentLength)
  }

  // Assemble and parse
  const combined = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }
  const text = new TextDecoder().decode(combined)
  return JSON.parse(text) as T
}

/** Module-level fetch lock so initial isLoading:true (skeleton) doesn't block the first call */
let fetching = false

export const useAnnouncementStore = create<AnnouncementState>()(
  persist(
    (set, get) => ({
      announcements: [],
      readIds: [],
      isLoading: true,
      loadError: false,

      loadAnnouncements: async () => {
        // Prevent concurrent fetches (independent of isLoading, which starts as true for skeleton)
        if (fetching) return
        fetching = true

        const startedAt = Date.now()
        set({ isLoading: true, loadError: false })

        // Register task with init store for progress tracking
        const initStore = useAppInitStore.getState()
        initStore.registerTask(TASK_ID)

        let didError = false

        try {
          const data = await fetchJSONWithProgress<unknown[]>(
            '/announcements.json',
            (fileProgress) => {
              const overall = 60 + fileProgress * 25
              useAppInitStore.getState().setProgress(overall)
            }
          )

          if (!Array.isArray(data)) throw new Error('Invalid data format')

          const validated = data
            .filter(
              (item): item is Announcement =>
                typeof item === 'object' &&
                item !== null &&
                typeof (item as Announcement).id === 'string' &&
                typeof (item as Announcement).title === 'string' &&
                typeof (item as Announcement).content === 'string' &&
                typeof (item as Announcement).publishTime === 'string'
            )
            .sort(
              (a, b) =>
                new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime()
            )

          const important = validated.filter((a) => a.priority === 'important')
          const normal = validated.filter((a) => a.priority === 'normal')
          const sorted = [...important, ...normal]

          const currentIds = new Set(sorted.map((a) => a.id))
          const { readIds } = get()
          const pruned = readIds.filter((id) => currentIds.has(id))

          set({ announcements: sorted, readIds: pruned })
        } catch {
          didError = true
        } finally {
          // Enforce minimum display time so skeleton doesn't flash
          const elapsed = Date.now() - startedAt
          if (elapsed < MIN_LOADING_DISPLAY_MS) {
            await new Promise((r) => setTimeout(r, MIN_LOADING_DISPLAY_MS - elapsed))
          }
          set({
            isLoading: false,
            loadError: didError,
            ...(didError ? { announcements: [] } : {})
          })
          fetching = false
          // Signal task completion to init store
          useAppInitStore.getState().completeTask(TASK_ID)
        }
      },

      markAsRead: (id: string) => {
        const { readIds } = get()
        if (readIds.includes(id)) return
        set({ readIds: [...readIds, id] })
      },

      markAllAsRead: () => {
        const { announcements } = get()
        set({ readIds: announcements.map((a) => a.id) })
      },
    }),
    {
      name: 'cep-announcement-read-ids',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ readIds: state.readIds }),
      skipHydration: true,
    }
  )
)

/** Derived selector: count of unread important announcements */
export function useImportantUnreadCount(): number {
  return useAnnouncementStore((s) =>
    s.announcements.filter(
      (a) => a.priority === 'important' && !s.readIds.includes(a.id)
    ).length
  )
}
