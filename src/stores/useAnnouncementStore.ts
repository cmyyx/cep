import { create } from 'zustand'
import type { Announcement } from '@/types/announcement'

const READ_IDS_KEY = 'cep-announcement-read-ids'

function loadReadIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(READ_IDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed
    }
    return []
  } catch {
    return []
  }
}

function saveReadIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(ids))
  } catch {
    // localStorage may be full or unavailable
  }
}

interface AnnouncementState {
  announcements: Announcement[]
  readIds: string[]
  isLoading: boolean
  loadAnnouncements: () => Promise<void>
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  announcements: [],
  readIds: loadReadIds(),
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
      set({ announcements: [...important, ...normal], isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  markAsRead: (id: string) => {
    const { readIds } = get()
    if (readIds.includes(id)) return
    const next = [...readIds, id]
    saveReadIds(next)
    set({ readIds: next })
  },

  markAllAsRead: () => {
    const { announcements } = get()
    const next = announcements.map((a) => a.id)
    saveReadIds(next)
    set({ readIds: next })
  },
}))

/** Derived selector: count of unread important announcements */
export function useImportantUnreadCount(): number {
  return useAnnouncementStore((s) =>
    s.announcements.filter(
      (a) => a.priority === 'important' && !s.readIds.includes(a.id)
    ).length
  )
}
