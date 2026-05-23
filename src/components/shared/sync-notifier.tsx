'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { setAutoSyncNotifyCallback } from '@/hooks/useAutoSync'
import { setDismissConflictToast } from '@/hooks/useAutoSync'

// ─── Types ─────────────────────────────────────────────────

type ToastKind = 'push_success' | 'push_unchanged' | 'pull_success' | 'conflict' | 'sync_error'

interface ToastState {
  id: number
  kind: ToastKind
  createdAt: number
  phase: 'in' | 'visible' | 'out'
}

// ─── Component ────────────────────────────────────────────

export function SyncNotifier() {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const removeToast = useCallback(() => {
    // Phase: visible → out (animation plays for 200ms)
    setToast(prev => {
      if (!prev || prev.phase !== 'visible') return prev
      return { ...prev, phase: 'out' }
    })
    // Remove from DOM after animation completes
    timerRef.current = setTimeout(() => {
      setToast(null)
    }, 220)
  }, [])

  const createToast = useCallback(
    (kind: ToastKind, duration: number | null) => {
      clearTimer()
      const id = ++idRef.current

      // Phase: in (animation plays for 300ms) → visible
      setToast({ id, kind, createdAt: Date.now(), phase: 'in' })
      timerRef.current = setTimeout(() => {
        setToast(prev => (prev?.id === id ? { ...prev, phase: 'visible' } : prev))
      }, 320)

      // Auto-dismiss after duration (only for success)
      if (duration !== null) {
        timerRef.current = setTimeout(() => {
          setToast(prev => {
            if (prev && prev.id === id && prev.phase === 'visible') {
              return { ...prev, phase: 'out' }
            }
            return prev
          })
          timerRef.current = setTimeout(() => {
            setToast(prev => (prev?.id === id ? null : prev))
          }, 220)
        }, 320 + duration)
      }
    },
    [],
  )

  // ── Register sync notification callback ────────────────
  // Use a ref for toast so the callback always sees current state
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
            // Refresh existing: out → in to restart progress bar animation
            setToast(prev => (prev ? { ...prev, phase: 'out' } : null))
            setTimeout(() => {
              createToast('push_success', 3000)
            }, 220)
          } else if (!current || current.phase === 'out') {
            createToast('push_success', 3000)
          }
          break
        }
        case 'push_unchanged': {
          // Show regardless — user explicitly clicked upload and deserves feedback.
          // If a push_success toast is already showing, fade it out first.
          if (current?.kind === 'push_success' && current.phase === 'visible') {
            setToast(prev => (prev ? { ...prev, phase: 'out' } : null))
            setTimeout(() => {
              createToast('push_unchanged', 3000)
            }, 220)
          } else if (!current || current.phase === 'out') {
            createToast('push_unchanged', 3000)
          }
          break
        }
        case 'pull_success': {
          if (current?.kind === 'pull_success' && current.phase === 'visible') {
            setToast(prev => (prev ? { ...prev, phase: 'out' } : null))
            setTimeout(() => {
              createToast('pull_success', 3000)
            }, 220)
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
          // Show error toast — don't overwrite an existing conflict toast
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
      setToast(prev => prev?.kind === 'conflict' ? null : prev)
    })
    return () => {
      clearTimer()
      setDismissConflictToast(null)
    }
  }, [])

  // ── Render ──────────────────────────────────────────────

  if (!toast || toast.phase === 'out') {
    // During 'out' phase, render the exiting element so animation plays
    if (toast?.phase === 'out') {
      return (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-toast-out">
          <ToastCard toast={toast} t={t} locale={locale} router={router} onRemove={removeToast} />
        </div>
      )
    }
    return null
  }

  const isIn = toast.phase === 'in'
  return (
    <div className={`fixed bottom-6 right-6 z-50 max-w-sm ${isIn ? 'animate-toast-in' : ''}`}>
      <ToastCard toast={toast} t={t} locale={locale} router={router} onRemove={removeToast} />
    </div>
  )
}

// ─── Inner card (extracted so it renders consistently in both in/visible/out phases) ──

function ToastCard({
  toast,
  t,
  locale,
  router,
  onRemove,
}: {
  toast: ToastState
  t: ReturnType<typeof useTranslations>
  locale: string
  router: ReturnType<typeof useRouter>
  onRemove: () => void
}) {
  const isConflict = toast.kind === 'conflict'
  const isPull = toast.kind === 'pull_success'
  const isUnchanged = toast.kind === 'push_unchanged'
  const isError = toast.kind === 'sync_error'

  return (
    <div
      className="rounded-lg bg-background overflow-hidden"
      style={{
        boxShadow:
          '0px 0px 0px 1px rgba(0,0,0,0.08), 0px 2px 2px rgba(0,0,0,0.04), 0px 8px 8px -8px rgba(0,0,0,0.04), 0px 0px 0px 1px #fafafa',
      }}
    >
      <div className="flex items-start gap-2.5 px-4 py-3">
        {isConflict || isError ? (
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-foreground" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[#0a72ef]" />
        )}
        <span className="flex-1 text-sm font-medium text-foreground leading-snug">
          {isConflict ? t('account.syncConflictToast') : isError ? t('account.syncErrorToast') : isPull ? t('account.syncDownloaded') : isUnchanged ? t('account.syncAlreadyUpToDate') : t('account.syncUploaded')}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isConflict && (
            <button
              className="text-xs text-[#0072f5] hover:underline"
              onClick={() => router.push(`/${locale}/account`)}
            >
              {t('account.goToAccount')}
            </button>
          )}
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={onRemove}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar (success only) */}
      {!isConflict && (
        <div className="h-[2px] bg-[#ebebeb]">
          <div
            key={toast.id}
            className="h-full bg-[#0a72ef] animate-toast-progress"
          />
        </div>
      )}
    </div>
  )
}
