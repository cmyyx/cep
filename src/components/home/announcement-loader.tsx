'use client'

import { useEffect } from 'react'
import { useAnnouncementStore } from '@/stores/useAnnouncementStore'

/** Mounts once in the root layout to hydrate persisted readIds and load announcements globally */
export function AnnouncementLoader() {
  const loadAnnouncements = useAnnouncementStore((s) => s.loadAnnouncements)

  useEffect(() => {
    // Rehydrate persisted readIds from localStorage (store uses skipHydration: true)
    void useAnnouncementStore.persist.rehydrate()
    // Fetch announcements so sidebar badge and banner show unread counts on all routes
    loadAnnouncements()
  }, [loadAnnouncements])

  return null
}
