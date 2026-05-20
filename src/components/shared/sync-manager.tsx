'use client'

import { useAutoSync } from '@/hooks/useAutoSync'
import { SyncNotifier } from './sync-notifier'

/** Mounts the auto-sync hook and global notification system.
 *  Must be rendered inside the locale layout. */
export function SyncManager() {
  useAutoSync()
  return <SyncNotifier />
}
