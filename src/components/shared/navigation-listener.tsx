'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useNavigationStore } from '@/stores/useNavigationStore'

/**
 * Listens for pathname changes and signals the navigation store
 * that navigation has completed (new page rendered).
 * Skips the initial mount to avoid clearing the overlay on first load.
 */
export function NavigationListener() {
  const pathname = usePathname()
  const finishNavigation = useNavigationStore((s) => s.finishNavigation)
  const isInitialMount = useRef(true)

  // useLayoutEffect fires synchronously after React commits, before the
  // browser paints. This ensures finishNavigation runs *inside* the View
  // Transition callback so the overlay is removed from snapshot B. Otherwise
  // both snapshots contain the overlay and the cross-fade does nothing.
  useLayoutEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    finishNavigation()
  }, [pathname, finishNavigation])

  return null
}
