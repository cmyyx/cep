'use client'

import { useTranslations } from 'next-intl'
import { Wrench } from 'lucide-react'
import { useMaintenanceProbe } from '@/hooks/use-maintenance-probe'
import { useSystemStatusStore } from '@/stores/useSystemStatusStore'

/**
 * Global "system under maintenance" strip.
 *
 * Raised by the API client on any `maintenance_mode` answer and lowered by the
 * first non-maintenance answer, so it stays visible until the backend is back
 * (see useSystemStatusStore).
 *
 * Mounted on /account only, right under the page title: the affected features
 * (sync, membership, redeem) all live there, and a site-wide strip would be
 * ambiguous, since the planners keep working while the backend is down.
 */
export function MaintenanceBanner() {
  const t = useTranslations()
  const maintenance = useSystemStatusStore((state) => state.maintenance)
  useMaintenanceProbe()

  if (!maintenance) return null

  return (
    <div
      data-nosnippet
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-2.5 px-4 py-2.5 text-sm bg-amber-50 text-amber-900 shadow-[var(--shadow-border-inset-b)] dark:bg-amber-950/60 dark:text-amber-100"
    >
      <Wrench className="size-4 shrink-0" aria-hidden="true" />
      <p className="font-medium leading-relaxed">{t('account.maintenanceMode')}</p>
    </div>
  )
}
