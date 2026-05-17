'use client'

import { useAutoSync } from '@/hooks/useAutoSync'

/** Mounts the auto-sync hook. Must be rendered inside the locale layout. */
export function SyncManager() {
  useAutoSync()
  return null
}
