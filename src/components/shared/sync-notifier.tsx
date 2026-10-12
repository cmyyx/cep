'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle2, AlertTriangle, X, RefreshCw, LogIn, Copy, ExternalLink, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { setAutoSyncNotifyCallback, setDismissConflictToast } from '@/hooks/useAutoSync'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToastUiStore } from '@/stores/useToastUiStore'
import { setAppToastHandler, type AppToastEvent } from '@/lib/app-toast'
import { useVersion } from '@/hooks/use-version'
import { onMissingTranslation, type MissingTranslationEvent } from '@/lib/missing-translation-guard'

// ─── Types ─────────────────────────────────────────────────

type ToastKind =
  | 'push_success'
  | 'push_unchanged'
  | 'pull_success'
  | 'conflict'
  | 'sync_error'
  | 'session_expired'
  | 'version_update'
  | 'missing_translation'
  | 'app_success'
  | 'app_error'

interface ToastState {
  id: number
  kind: ToastKind
  createdAt: number
  phase: 'in' | 'visible' | 'out'
  /** Auto-dismiss duration in ms; null = persistent (no progress bar). */
  duration: number | null
  payload?: MissingTranslationEvent
  /** 应用消息正文（已翻译），仅 app_* 使用。 */
  text?: string
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

  const createToast = useCallback(
    (kind: ToastKind, duration: number | null, payload?: MissingTranslationEvent, text?: string) => {
      clearAllTimers()
      const id = ++idRef.current

      setToast({ id, kind, createdAt: Date.now(), phase: 'in', duration, payload, text })
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

  // ── App messages (data-import results) share this single toast slot ──
  // 数据导入原先自己渲染一个 fixed bottom-6 right-6 的提示，位置与同步通知完全
  // 重叠；现在统一走这里，且不抢占持久通知（冲突/会话过期）的槽位。
  const pendingAppToastRef = useRef<AppToastEvent | null>(null)

  const flushPendingAppToast = useCallback(() => {
    const pending = pendingAppToastRef.current
    if (!pending) return
    pendingAppToastRef.current = null
    createToast(
      pending.tone === 'success' ? 'app_success' : 'app_error',
      pending.tone === 'success' ? 3500 : 6000,
      undefined,
      pending.text,
    )
  }, [createToast])

  const removeToast = useCallback(() => {
    setToast((prev) => {
      if (!prev || prev.phase !== 'visible') return prev
      return { ...prev, phase: 'out' }
    })
    addTimer(
      setTimeout(() => {
        setToast(null)
        // 持久通知退场后，把排队等着的应用消息放出来。
        flushPendingAppToast()
      }, 220),
    )
  }, [flushPendingAppToast])

  useEffect(() => {
    // 直接用 toast 状态（而不是 ref）决定是否排队，React Compiler 不希望
    // 跨 effect 读写同一个 ref。
    setAppToastHandler((event) => {
      if (toast && toast.phase !== 'out' && toast.duration === null) {
        // 持久通知在场：排队等它消失，否则重要提示会被默默顶掉。
        pendingAppToastRef.current = event
        return
      }
      createToast(
        event.tone === 'success' ? 'app_success' : 'app_error',
        event.tone === 'success' ? 3500 : 6000,
        undefined,
        event.text,
      )
    })
    return () => setAppToastHandler(null)
  }, [toast, createToast])

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

  // ── Missing translation notification ────────────────────

  useEffect(() => {
    return onMissingTranslation((event) => {
      createToast('missing_translation', 6000, event)
    })
  }, [createToast])

  // ── Publish toast visibility for corner floats (update changelog notice) ──

  useEffect(() => {
    useToastUiStore.getState().setSyncToastVisible(toast !== null)
    return () => useToastUiStore.getState().setSyncToastVisible(false)
  }, [toast])

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
      setToast((prev) => {
        if (prev?.kind !== 'conflict') return prev
        // 冲突提示被账号页解决后，把排队等着的应用消息放出来。
        addTimer(
          setTimeout(() => {
            flushPendingAppToast()
          }, 0),
        )
        return null
      })
    })
    return () => {
      clearAllTimers()
      setDismissConflictToast(null)
    }
  }, [flushPendingAppToast])

  const [copiedToastId, setCopiedToastId] = useState<number | null>(null)

  const handleCopyMissing = useCallback(
    async (toastId: number, missingEvent: MissingTranslationEvent) => {
      const pageUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : ''
      const info = JSON.stringify(
        {
          key: missingEvent.key,
          locale: missingEvent.locale,
          category: missingEvent.category,
          url: pageUrl,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        },
        null,
        2
      )
      try {
        await navigator.clipboard.writeText(info)
        setCopiedToastId(toastId)
        timersRef.current.push(
          setTimeout(() => {
            setCopiedToastId((current) => (current === toastId ? null : current))
          }, 2000)
        )
      } catch {
        // Ignore clipboard failure
      }
    },
    []
  )

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
            copied={copiedToastId === toast.id}
            onCopy={() => toast.payload && handleCopyMissing(toast.id, toast.payload)}
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
        copied={copiedToastId === toast.id}
        onCopy={() => toast.payload && handleCopyMissing(toast.id, toast.payload)}
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
  copied,
  onCopy,
}: {
  toast: ToastState
  t: ReturnType<typeof useTranslations>
  locale: string
  router: ReturnType<typeof useRouter>
  onRemove: () => void
  refreshPage: () => void
  copied: boolean
  onCopy: () => void
}) {
  const isConflict = toast.kind === 'conflict'
  const isError = toast.kind === 'sync_error'
  const isSessionExpired = toast.kind === 'session_expired'
  const isVersionUpdate = toast.kind === 'version_update'
  const isMissingTranslation = toast.kind === 'missing_translation'
  // 应用消息（数据导入结果）：正文由调用方传入，配色区分成功/失败。
  const isAppError = toast.kind === 'app_error'
  const isAppMessage = isAppError || toast.kind === 'app_success'
  const isWarning =
    isConflict || isError || isSessionExpired || isVersionUpdate || isMissingTranslation || isAppError
  const isPersistent = toast.duration === null
  const iconClass = isAppMessage
    ? isAppError ? 'text-red-500' : 'text-green-500'
    : isWarning ? 'text-amber-500' : 'text-[#0a72ef]'

  const missingEvent = isMissingTranslation ? toast.payload : undefined
  const pageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : ''

  const issueUrl = missingEvent
    ? `https://github.com/cmyyx/cep/issues/new?title=${encodeURIComponent(
        `[Game i18n Missing] ${missingEvent.key} (${missingEvent.locale})`
      )}&body=${encodeURIComponent(
        [
          `### Missing Game i18n Key`,
          `- **Key**: \`${missingEvent.key}\``,
          `- **Locale**: \`${missingEvent.locale}\``,
          `- **Category**: \`${missingEvent.category ?? 'unknown'}\``,
          `- **Page**: \`${pageUrl}\``,
          `- **User Agent**: \`${typeof navigator !== 'undefined' ? navigator.userAgent : ''}\``,
        ].join('\n')
      )}`
    : undefined

  const message = isAppMessage
    ? toast.text ?? ''
    : isConflict
    ? t('account.syncConflictToast')
    : isError
      ? t('account.syncErrorToast')
      : isSessionExpired
        ? t('account.sessionExpiredToast')
        : isVersionUpdate
          ? t('version.updateAvailableToast')
          : isMissingTranslation
            ? `${t('common.missingTranslationTitle')}: ${missingEvent?.key ?? ''}`
            : toast.kind === 'pull_success'
              ? t('account.syncDownloaded')
              : toast.kind === 'push_unchanged'
                ? t('account.syncAlreadyUpToDate')
                : t('account.syncUploaded')

  return (
    <div
      role="alert"
      className="rounded-lg bg-background overflow-hidden"
      style={{
        boxShadow:
          '0px 0px 0px 1px rgba(0,0,0,0.08), 0px 2px 2px rgba(0,0,0,0.04), 0px 8px 8px -8px rgba(0,0,0,0.04), 0px 0px 0px 1px #fafafa',
      }}
    >
      <div className="flex items-start gap-2.5 px-4 py-3">
        {isWarning ? (
          <AlertTriangle className={cn('size-4 shrink-0 mt-0.5', iconClass)} />
        ) : (
          <CheckCircle2 className={cn('size-4 shrink-0 mt-0.5', iconClass)} />
        )}
        <span
          className={cn(
            'flex-1 text-sm font-medium text-foreground leading-snug break-all',
            isVersionUpdate && 'cursor-pointer hover:underline',
          )}
          onClick={isVersionUpdate ? refreshPage : undefined}
        >
          {message}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isMissingTranslation && (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={onCopy}
                aria-label={copied ? t('common.reportCopied') : t('common.copyReportInfo')}
                title={copied ? t('common.reportCopied') : t('common.copyReportInfo')}
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </Button>
              {issueUrl && (
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
                    'text-muted-foreground hover:text-foreground transition-colors'
                  )}
                  aria-label={t('common.reportToGithub')}
                  title={t('common.reportToGithub')}
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </>
          )}
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
