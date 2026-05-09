import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Announcement } from '@/types/announcement'

interface AnnouncementState {
  announcements: Announcement[]
  readIds: string[]
  isLoading: boolean
  loadAnnouncements: () => Promise<void>
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

export const useAnnouncementStore = create<AnnouncementState>()(
  persist(
    (set, get) => ({
      announcements: [],
      readIds: [],
      isLoading: false,

      loadAnnouncements: async () => {
        const { announcements } = get()
        // Already loaded — skip re-fetch (announcements update only on hard refresh via version prompt)
        if (announcements.length > 0) return

        set({ isLoading: true })
        try {
          const res = await fetch('/announcements.json')
          if (!res.ok) return
          const data: unknown = await res.json()
          if (!Array.isArray(data)) return
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
          // important announcements always come first
          const important = validated.filter((a) => a.priority === 'important')
          const normal = validated.filter((a) => a.priority === 'normal')
          const sorted = [...important, ...normal]

          // Prune readIds: remove IDs for announcements that no longer exist
          const currentIds = new Set(sorted.map((a) => a.id))
          const { readIds } = get()
          const pruned = readIds.filter((id) => currentIds.has(id))

          set({ announcements: sorted, readIds: pruned, isLoading: false })
        } catch {
          // isLoading reset in finally
        } finally {
          set({ isLoading: false })
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
