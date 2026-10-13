'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle2, AlertTriangle, X, RefreshCw, LogIn, Copy, ExternalLink, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { setAutoSyncNotifyCallback, setDismissConflictToast } from '@/hooks/useAutoSync'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToastUiStore } from '@/stores/useToastUiStore'
import { setAppToastHandler } from '@/lib/app-toast'
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
  const [toasts, setToasts] = useState<ToastState[]>([])
  /** 每条通知一条自己的定时器: 新建通知绝不能清掉别人已排好的自动消失定时器。 */
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>[]>>(new Map())
  const idRef = useRef(0)
  /** 回调里必须同步读到最新列表: 同一批事件连续到达时 state 还没重渲染。 */
  const toastsRef = useRef<ToastState[]>([])

  const commit = useCallback((next: ToastState[]) => {
    toastsRef.current = next
    setToasts(next)
    // 右下角常驻浮层 (UpdateChangelogNotice) 靠这个值避让。
    useToastUiStore.getState().setSyncToastVisible(next.length > 0)
  }, [])

  const clearTimers = useCallback((id: number) => {
    for (const timer of timersRef.current.get(id) ?? []) clearTimeout(timer)
    timersRef.current.delete(id)
  }, [])

  const addTimer = useCallback((id: number, timer: ReturnType<typeof setTimeout>) => {
    const timers = timersRef.current.get(id) ?? []
    timers.push(timer)
    timersRef.current.set(id, timers)
  }, [])

  const removeWhere = useCallback(
    (predicate: (entry: ToastState) => boolean) => {
      for (const entry of toastsRef.current) {
        if (predicate(entry)) clearTimers(entry.id)
      }
      commit(toastsRef.current.filter((entry) => !predicate(entry)))
    },
    [clearTimers, commit],
  )

  const patchToast = useCallback(
    (id: number, patch: Partial<ToastState>) => {
      commit(toastsRef.current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
    },
    [commit],
  )

  const createToast = useCallback(
    (kind: ToastKind, duration: number | null, payload?: MissingTranslationEvent, text?: string) => {
      const id = ++idRef.current
      // missing_translation 复用同一个位置: 新 key 顶掉旧 key, 否则上一条的「已复制」状态会跟过来。
      if (kind === 'missing_translation') removeWhere((entry) => entry.kind === kind)

      commit([
        ...toastsRef.current,
        { id, kind, createdAt: Date.now(), phase: 'in', duration, payload, text },
      ])
      addTimer(
        id,
        setTimeout(() => patchToast(id, { phase: 'visible' }), 320),
      )

      // Auto-dismiss — timer starts from toast creation so it aligns with
      // the progress bar which also starts at render time.
      if (duration !== null) {
        addTimer(
          id,
          setTimeout(() => {
            if (toastsRef.current.find((entry) => entry.id === id)?.phase === 'visible') {
              patchToast(id, { phase: 'out' })
            }
            addTimer(id, setTimeout(() => removeWhere((entry) => entry.id === id), 220))
          }, duration),
        )
      }
    },
    [addTimer, commit, patchToast, removeWhere],
  )

  const hasKind = useCallback(
    (kind: ToastKind) => toastsRef.current.some((entry) => entry.kind === kind),
    [],
  )

  /** 手动关闭某一条: 先淡出, 再从列表里摘掉。 */
  const removeToast = useCallback(
    (id: number) => {
      if (toastsRef.current.find((entry) => entry.id === id)?.phase !== 'visible') return
      patchToast(id, { phase: 'out' })
      addTimer(id, setTimeout(() => removeWhere((entry) => entry.id === id), 220))
    },
    [addTimer, patchToast, removeWhere],
  )

  // ── App messages (data-import results) share this toast surface ──
  // 数据导入原先自己渲染一个 fixed bottom-6 right-6 的提示，位置与同步通知完全
  // 重叠；现在统一走这里。通知是垂直堆叠的列表，任何一条都不阻塞另一条。
  useEffect(() => {
    setAppToastHandler((event) => {
      createToast(
        event.tone === 'success' ? 'app_success' : 'app_error',
        event.tone === 'success' ? 3500 : 6000,
        undefined,
        event.text,
      )
    })
    return () => setAppToastHandler(null)
  }, [createToast])

  // ── Session expiry notification ─────────────────────────

  const sessionExpired = useAuthStore((s) => s.sessionExpired)
  const prevSessionExpired = useRef(sessionExpired)
  useEffect(() => {
    if (sessionExpired && !prevSessionExpired.current && !hasKind('session_expired')) {
      createToast('session_expired', null) // persistent
    }
    prevSessionExpired.current = sessionExpired
  }, [sessionExpired, createToast, hasKind])

  // ── Version update notification ─────────────────────────

  const { isUpdateAvailable, refreshPage } = useVersion()
  const prevUpdateAvailable = useRef(isUpdateAvailable)
  useEffect(() => {
    if (isUpdateAvailable && !prevUpdateAvailable.current && !hasKind('version_update')) {
      createToast('version_update', null)
    }
    prevUpdateAvailable.current = isUpdateAvailable
  }, [isUpdateAvailable, createToast, hasKind])

  // ── Missing translation notification ────────────────────

  useEffect(() => {
    return onMissingTranslation((event) => {
      createToast('missing_translation', 6000, event)
    })
  }, [createToast])

  // ── Register sync notification callback ────────────────

  useEffect(() => {
    setAutoSyncNotifyCallback((event) => {
      switch (event.type) {
        case 'push_success':
          createToast('push_success', 3000)
          break
        case 'push_unchanged':
          createToast('push_unchanged', 3000)
          break
        case 'pull_success':
          createToast('pull_success', 3000)
          break
        case 'push_conflict':
        case 'pull_conflict':
          // 持久通知: 已经在场就不再追加第二条。
          if (!hasKind('conflict')) createToast('conflict', null)
          break
        case 'sync_error':
          createToast('sync_error', 5000)
          break
      }
    })
    return () => setAutoSyncNotifyCallback(null)
  }, [createToast, hasKind])

  // Cleanup on unmount
  useEffect(() => {
    setDismissConflictToast(() => {
      // 冲突提示被账号页解决后只摘掉它自己, 其它通知原地不动。
      removeWhere((entry) => entry.kind === 'conflict')
    })
    const timers = timersRef.current
    return () => {
      for (const list of timers.values()) {
        for (const timer of list) clearTimeout(timer)
      }
      timers.clear()
      setDismissConflictToast(null)
      useToastUiStore.getState().setSyncToastVisible(false)
    }
  }, [removeWhere])

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
        addTimer(
          toastId,
          setTimeout(() => {
            setCopiedToastId((current) => (current === toastId ? null : current))
          }, 2000)
        )
      } catch {
        // Ignore clipboard failure
      }
    },
    [addTimer]
  )

  // ── Render ──────────────────────────────────────────────

  if (toasts.length === 0) return null

  // 多条通知垂直堆叠: 最新一条在最上方, 先出现的（含持久通知）留在角落。
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col-reverse items-end gap-2">
      {toasts.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            'max-w-sm',
            entry.phase === 'in'
              ? 'animate-toast-in'
              : entry.phase === 'out' && 'animate-toast-out',
          )}
        >
          <ToastCard
            toast={entry}
            t={t}
            locale={locale}
            router={router}
            onRemove={() => removeToast(entry.id)}
            refreshPage={refreshPage}
            copied={copiedToastId === entry.id}
            onCopy={() => entry.payload && handleCopyMissing(entry.id, entry.payload)}
          />
        </div>
      ))}
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
