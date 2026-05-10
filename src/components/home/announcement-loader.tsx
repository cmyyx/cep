'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAnnouncementStore } from '@/stores/useAnnouncementStore'

/**
 * Hydrates persisted readIds then loads announcements.
 * Re-fetches on every route change so announcements stay fresh across SPA navigations.
 */
export function AnnouncementLoader() {
  const pathname = usePathname()
  const loadAnnouncements = useAnnouncementStore((s) => s.loadAnnouncements)

  useEffect(() => {
    const init = async () => {
      await useAnnouncementStore.persist.rehydrate()
      loadAnnouncements()
    }
    init()
  }, [pathname, loadAnnouncements])

  return null
}
