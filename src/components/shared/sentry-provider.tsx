'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/react'
import type { VersionInfo } from '@/types/version'
import { shouldDropSentryEvent } from '@/lib/sentry-event-filter'

export interface SentryProviderProps {
  /** Build-time version info, used as the Sentry release + environment tags. */
  version: VersionInfo
  children: React.ReactNode
}

// Module-level guard: init runs exactly once per page session, even under
// React StrictMode (mount→unmount→mount in dev) and HMR reloads. Without this
// guard the effect fires twice in dev, creating a second replayIntegration()
// and throwing "Multiple Sentry Session Replay instances".
let initialized = false

/**
 * Initializes the browser-only Sentry SDK for the static SSG export.
 *
 * Why @sentry/react and not @sentry/nextjs: this site is `output: "export"`
 * deployed to Cloudflare Pages with no Node/Edge runtime, so the Next.js SDK's
 * server/edge configs and `onRequestError` are inert here. The browser runtime
 * is the only one that ever executes in production.
 *
 * DSN comes from NEXT_PUBLIC_SENTRY_DSN (inlined at build time by Next.js into
 * the static bundle — SSG has no runtime env). If unset, init is skipped so dev
 * without a DSN stays clean.
 *
 * release / environment are derived from the prebuild-generated versionData so
 * every event is tied to an exact application version for regression detection,
 * source map lookup, and resolve-in-next-release workflows.
 *
 * The module-level guard (not React) owns the "once per session" invariant:
 * useEffect's StrictMode double-invoke and HMR both re-render the component,
 * but neither re-runs the guarded init block.
 */
export function SentryProvider({ version, children }: SentryProviderProps) {
  useEffect(() => {
    if (initialized) return
    initialized = true
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (!dsn) return

    Sentry.init({
      dsn,
      release: version.version,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      // SDK recommended default: 100% in dev for full repro, 10% in prod to control volume.
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Record 100% of sessions that hit an error, 0% of healthy ones.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      beforeSend(event, hint) {
        return shouldDropSentryEvent(event, hint) ? null : event
      },
      // Don't send default PII (IP, cookies) — opt in later per category if needed.
      sendDefaultPii: false,
    })
  }, [version.version])

  return <>{children}</>
}
