'use client'

import { useEffect, useSyncExternalStore } from 'react'
import * as Sentry from '@sentry/react'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { FullScreenStatus } from '@/components/shared/full-screen-status'
import { GuardEnvironmentInfo } from '@/components/shared/guard-environment-info'
import { Button } from '@/components/ui/button'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useVersion } from '@/hooks/use-version'

/**
 * Catches webpack ChunkLoadError (failed dynamic import() of route chunks).
 *
 * Causes:
 * - Deploy rolled out new chunk hashes; user's stale HTML still references old
 *   hashes that no longer exist → 404 on import.
 * - Transient CDN/network blip mid-navigation.
 *
 * Without this guard the page is stuck on NavigationLoadingOverlay forever
 * (NavigationListener only fires on pathname change, not on import rejection).
 *
 * Behaviour:
 * 1. First failure → auto reload once (clears stale HTML, fetches fresh chunk
 *    references). Guarded by sessionStorage so we never loop.
 * 2. Second failure → stop reloading, show a full-screen error page with the
 *    failing resource URL, version info, and a manual retry button.
 */

const SESSION_KEY = 'cep-chunk-reload-once'

/** Module-level failure store — survives React remounts within the same page session. */
type ChunkFailure = { url: string; message: string; time: number }

let currentFailure: ChunkFailure | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function setFailure(failure: ChunkFailure | null) {
  currentFailure = failure
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentFailure
}

function getServerSnapshot() {
  return null
}

/** Extract the failing module URL from a ChunkLoadError, if recognisable. */
function extractFailureUrl(error: unknown): string {
  if (error == null) return ''
  const e = error as { message?: string; request?: string; filename?: string }
  const raw = e.message ?? ''
  // webpack 5 message shape: "Loading chunk <n> failed.\n(error: <url>)"
  const urlMatch = raw.match(/https?:\/\/[^\s')]+/i)
  if (urlMatch) return urlMatch[0]
  if (typeof e.request === 'string' && e.request) return e.request
  return ''
}

function isChunkLoadError(error: unknown): boolean {
  if (error == null) return false
  const e = error as { name?: string; message?: string }
  if (e.name === 'ChunkLoadError') return true
  const message = e.message ?? ''
  // Covers webpack "Loading chunk N failed" and Vite/native
  // "Failed to fetch dynamically imported module".
  return (
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // sessionStorage may be unavailable (private mode) — swallow, accept the
    // tiny risk of a reload loop under a persistent server-side chunk error.
  }
}

function clearReloaded() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

function handleFailure(error: unknown) {
  if (!isChunkLoadError(error)) return
  // Abort the navigation UI so the overlay/progress bar stops spinning while
  // the page is about to reload (weak network can stretch the unload gap
  // by several seconds) or while we surface the full-screen error page.
  useNavigationStore.getState().resetNavigation()
  const failure: ChunkFailure = {
    url: extractFailureUrl(error),
    message: (error as { message?: string }).message ?? String(error),
    time: Date.now(),
  }
  // Report to Sentry with the failing URL as a tag — invaluable for spotting
  // deploy-stale chunk hashes or bad CDN edges across users.
  Sentry.captureException(error, {
    tags: { chunk_load_error: true },
    extra: { resource: failure.url, auto_reload: !alreadyReloaded() },
  })

  if (!alreadyReloaded()) {
    markReloaded()
    // Give other listeners (logging) a tick, then hard reload.
    window.location.reload()
    return
  }
  setFailure(failure)
}

function ChunkLoadErrorPage({ failure }: { failure: ChunkFailure }) {
  const t = useTranslations('chunkError')
  const { localInfo } = useVersion()

  const handleRetry = () => {
    clearReloaded()
    setFailure(null)
    window.location.reload()
  }

  return (
    <FullScreenStatus
      title="CEP"
      heading={t('title')}
      tone="destructive"
      animateIcon
      description={t('description')}
      indicator={
        <div className="w-full max-w-md space-y-1 rounded-lg bg-muted/40 p-3 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
          {failure.url ? (
            <p className="break-all">
              <span className="text-foreground/70">{t('resource')}:</span>{' '}
              {failure.url.replace(/^https?:\/\/[^/]+/, '')}
            </p>
          ) : null}
          <p className="break-all">
            <span className="text-foreground/70">{t('detail')}:</span> {failure.message}
          </p>
        </div>
      }
      actions={
        <>
          <Button onClick={handleRetry}>
            <RefreshCw className="size-4" />
            {t('retry')}
          </Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            {t('goHome')}
          </Button>
        </>
      }
      metadata={<GuardEnvironmentInfo versionInfo={localInfo} />}
    />
  )
}

export function ChunkLoadErrorGuard() {
  const failure = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      handleFailure(event.error ?? event.message)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      handleFailure(event.reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  // The error page renders once a chunk failure has been recorded. SSR
  // returns null via getServerSnapshot, so the guard is a no-op during
  // static export until a client-side failure fires.
  if (failure) {
    return <ChunkLoadErrorPage failure={failure} />
  }
  return null
}

/** Test-only: reset module-level failure state between tests. */
export function __resetChunkLoadErrorForTests() {
  currentFailure = null
  listeners.clear()
}
