'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle2, AlertTriangle, X, RefreshCw, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { setAutoSyncNotifyCallback, setDismissConflictToast } from '@/hooks/useAutoSync'
import { useAuthStore } from '@/stores/useAuthStore'
import { useVersion } from '@/hooks/use-version'

// ─── Types ─────────────────────────────────────────────────

type ToastKind =
  | 'push_success'
  | 'push_unchanged'
  | 'pull_success'
  | 'conflict'
  | 'sync_error'
  | 'session_expired'
  | 'version_update'

interface ToastState {
  id: number
  kind: ToastKind
  createdAt: number
  phase: 'in' | 'visible' | 'out'
  /** Auto-dismiss duration in ms; null = persistent (no progress bar). */
  duration: number | null
}

// ─── Component ────────────────────────────────────────────

export function SyncNotifier() {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()
  const [toast, setToast] = useState<ToastState | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const idRef = useRef(0)

  const clearAllTimers = () => {
    for (const id of timersRef.current) clearTimeout(id)
    timersRef.current = []
  }

  const addTimer = (id: ReturnType<typeof setTimeout>) => {
    timersRef.current.push(id)
  }

  const removeToast = useCallback(() => {
    setToast((prev) => {
      if (!prev || prev.phase !== 'visible') return prev
      return { ...prev, phase: 'out' }
    })
    addTimer(
      setTimeout(() => {
        setToast(null)
      }, 220),
    )
  }, [])

  const createToast = useCallback(
    (kind: ToastKind, duration: number | null) => {
      clearAllTimers()
      const id = ++idRef.current

      setToast({ id, kind, createdAt: Date.now(), phase: 'in', duration })
      addTimer(
        setTimeout(() => {
          setToast((prev) =>
            prev?.id === id ? { ...prev, phase: 'visible' } : prev,
          )
        }, 320),
      )

      // Auto-dismiss — timer starts from toast creation so it aligns with
      // the progress bar which also starts at render time.
      if (duration !== null) {
        addTimer(
          setTimeout(() => {
            setToast((prev) => {
              if (prev && prev.id === id && prev.phase === 'visible') {
                return { ...prev, phase: 'out' }
              }
              return prev
            })
            addTimer(
              setTimeout(() => {
                setToast((prev) => (prev?.id === id ? null : prev))
              }, 220),
            )
          }, duration),
        )
      }
    },
    [],
  )

  // ── Session expiry notification ─────────────────────────

  const sessionExpired = useAuthStore((s) => s.sessionExpired)
  const prevSessionExpired = useRef(sessionExpired)
  useEffect(() => {
    if (sessionExpired && !prevSessionExpired.current) {
      createToast('session_expired', null) // persistent
    }
    prevSessionExpired.current = sessionExpired
  }, [sessionExpired, createToast])

  // ── Version update notification ─────────────────────────

  const { isUpdateAvailable, refreshPage } = useVersion()
  const prevUpdateAvailable = useRef(isUpdateAvailable)
  useEffect(() => {
    if (isUpdateAvailable && !prevUpdateAvailable.current) {
      createToast('version_update', null)
    }
    prevUpdateAvailable.current = isUpdateAvailable
  }, [isUpdateAvailable, createToast])

  // ── Register sync notification callback ────────────────

  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  useEffect(() => {
    setAutoSyncNotifyCallback((event) => {
      const current = toastRef.current

      switch (event.type) {
        case 'push_success': {
          if (current?.kind === 'push_success' && current.phase === 'visible') {
            setToast((prev) => (prev ? { ...prev, phase: 'out' } : null))
            addTimer(setTimeout(() => {
              createToast('push_success', 3000)
            }, 220))
          } else if (!current || current.phase === 'out') {
            createToast('push_success', 3000)
          }
          break
        }
        case 'push_unchanged': {
          if (current?.kind === 'push_success' && current.phase === 'visible') {
            setToast((prev) => (prev ? { ...prev, phase: 'out' } : null))
            addTimer(setTimeout(() => {
              createToast('push_unchanged', 3000)
            }, 220))
          } else if (!current || current.phase === 'out') {
            createToast('push_unchanged', 3000)
          }
          break
        }
        case 'pull_success': {
          if (current?.kind === 'pull_success' && current.phase === 'visible') {
            setToast((prev) => (prev ? { ...prev, phase: 'out' } : null))
            addTimer(setTimeout(() => {
              createToast('pull_success', 3000)
            }, 220))
          } else if (!current || current.phase === 'out') {
            createToast('pull_success', 3000)
          }
          break
        }
        case 'push_conflict':
        case 'pull_conflict': {
          if (current?.kind === 'conflict' && current.phase !== 'out') break
          createToast('conflict', null)
          break
        }
        case 'sync_error': {
          if (current?.kind === 'conflict' && current.phase !== 'out') break
          if (!current || current.phase === 'out') {
            createToast('sync_error', 5000)
          }
          break
        }
      }
    })
    return () => setAutoSyncNotifyCallback(null)
  }, [createToast, pathname])

  // Cleanup on unmount
  useEffect(() => {
    setDismissConflictToast(() => {
      setToast((prev) => (prev?.kind === 'conflict' ? null : prev))
    })
    return () => {
      clearAllTimers()
      setDismissConflictToast(null)
    }
  }, [])

  // ── Render ──────────────────────────────────────────────

  if (!toast || toast.phase === 'out') {
    if (toast?.phase === 'out') {
      return (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm animate-toast-out">
          <ToastCard
            toast={toast}
            t={t}
            locale={locale}
            router={router}
            onRemove={removeToast}
            refreshPage={refreshPage}
          />
        </div>
      )
    }
    return null
  }

  const isIn = toast.phase === 'in'
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] max-w-sm ${isIn ? 'animate-toast-in' : ''}`}
    >
      <ToastCard
        toast={toast}
        t={t}
        locale={locale}
        router={router}
        onRemove={removeToast}
        refreshPage={refreshPage}
      />
    </div>
  )
}

// ─── Inner card ───────────────────────────────────────────

function ToastCard({
  toast,
  t,
  locale,
  router,
  onRemove,
  refreshPage,
}: {
  toast: ToastState
  t: ReturnType<typeof useTranslations>
  locale: string
  router: ReturnType<typeof useRouter>
  onRemove: () => void
  refreshPage: () => void
}) {
  const isConflict = toast.kind === 'conflict'
  const isError = toast.kind === 'sync_error'
  const isSessionExpired = toast.kind === 'session_expired'
  const isVersionUpdate = toast.kind === 'version_update'
  const isWarning = isConflict || isError || isSessionExpired || isVersionUpdate
  const isPersistent = toast.duration === null

  const message = isConflict
    ? t('account.syncConflictToast')
    : isError
      ? t('account.syncErrorToast')
      : isSessionExpired
        ? t('account.sessionExpiredToast')
        : isVersionUpdate
          ? t('version.updateAvailableToast')
          : toast.kind === 'pull_success'
            ? t('account.syncDownloaded')
            : toast.kind === 'push_unchanged'
              ? t('account.syncAlreadyUpToDate')
              : t('account.syncUploaded')

  return (
    <div
      className="rounded-lg bg-background overflow-hidden"
      style={{
        boxShadow:
          '0px 0px 0px 1px rgba(0,0,0,0.08), 0px 2px 2px rgba(0,0,0,0.04), 0px 8px 8px -8px rgba(0,0,0,0.04), 0px 0px 0px 1px #fafafa',
      }}
    >
      <div className="flex items-start gap-2.5 px-4 py-3">
        {isWarning ? (
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-foreground" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[#0a72ef]" />
        )}
        <span
          className={cn(
            'flex-1 text-sm font-medium text-foreground leading-snug',
            isVersionUpdate && 'cursor-pointer hover:underline',
          )}
          onClick={isVersionUpdate ? refreshPage : undefined}
        >
          {message}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isConflict && (
            <Button
              variant="link"
              size="sm"
              className="text-xs text-[#0072f5] hover:underline h-auto p-0"
              onClick={() => router.push(`/${locale}/account`)}
            >
              {t('account.goToAccount')}
            </Button>
          )}
          {isSessionExpired && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => router.push(`/${locale}/login?expired=1`)}
              aria-label={t('account.sessionExpired')}
            >
              <LogIn className="size-3.5" />
            </Button>
          )}
          {isVersionUpdate && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={refreshPage}
              aria-label={t('version.updateAvailable')}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={onRemove}
            aria-label={t('common.close')}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress bar — only for auto-dismiss toasts (duration !== null).
          Uses dynamic duration so it perfectly aligns with the toast lifetime. */}
      {!isPersistent && toast.duration !== null && (
        <div className="h-[2px] bg-[#ebebeb]">
          <div
            key={toast.id}
            className="h-full bg-[#0a72ef]"
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
              transformOrigin: 'left center',
            }}
          />
        </div>
      )}
    </div>
  )
}
