'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAnnouncementStore } from '@/stores/useAnnouncementStore'

/**
 * Triggers announcement loading on mount and on every route change.
 * Hydration is handled automatically by Zustand persist (no skipHydration).
 */
export function AnnouncementLoader() {
  const pathname = usePathname()
  const loadAnnouncements = useAnnouncementStore((s) => s.loadAnnouncements)

  useEffect(() => {
    loadAnnouncements()
  }, [pathname, loadAnnouncements])

  return null
}
