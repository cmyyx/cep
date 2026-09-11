'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api'
import { useSystemStatusStore } from '@/stores/useSystemStatusStore'

/**
 * How often to re-check while the banner is visible. Kept deliberately slow:
 * any request the user makes already clears the banner instantly, so this only
 * covers the idle case (page left open during maintenance).
 */
export const MAINTENANCE_PROBE_INTERVAL_MS = 300_000

/**
 * Endpoint used to probe. It must be **behind** the maintenance middleware —
 * `/api/health` is exempt, so it would always look healthy and the banner would
 * never clear itself.
 */
export const MAINTENANCE_PROBE_PATH = '/api/auth/me'

/**
 * While the maintenance banner is visible, poll a maintenance-gated endpoint so
 * the banner clears itself once the backend serves again, without the user
 * having to reload the page or click anything. The API client already reports
 * every outcome into the system-status store, so the probe only has to fire the
 * request (and swallow the error it will come back with).
 */
export function useMaintenanceProbe(): void {
  const maintenance = useSystemStatusStore((state) => state.maintenance)

  useEffect(() => {
    if (!maintenance) return

    const probe = async () => {
      try {
        await api(MAINTENANCE_PROBE_PATH, { noAuth: true })
      } catch {
        /* The API client already reported the result into the store. */
      }
    }

    const timer = setInterval(() => {
      void probe()
    }, MAINTENANCE_PROBE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [maintenance])
}
