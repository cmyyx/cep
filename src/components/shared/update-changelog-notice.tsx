'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useVersion } from '@/hooks/use-version'
import { formatTime, cn } from '@/lib/utils'
import {
  fetchChangelog,
  getEntriesSince,
  getEntriesSinceLastTag,
  readLastSeenCommit,
  writeLastSeenCommit,
} from '@/lib/changelog'
import { useToastUiStore } from '@/stores/useToastUiStore'
import type { ChangelogEntry } from '@/types/version'

const MAX_VISIBLE_ENTRIES = 10

/**
 * 更新后的角落通知:新 bundle 加载时对比 localStorage 记录的"上次访问 commit",
 * 展示本次更新的日志(最多 10 条,超出提供完整日志入口)。
 * 无记录(首次访问/首个支持该功能的版本)时回退展示自最近 release tag 起的条目。
 * 同 commit 重部署(lastSeenCommit === 当前 commit)不展示。
 */
export function UpdateChangelogNotice() {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const { localInfo } = useVersion()
  // 右下角 sync toast 显示时上移避让
  const toastVisible = useToastUiStore((s) => s.syncToastVisible)
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null)
  const [visible, setVisible] = useState(false)
  const handledRef = useRef(false)
  useEffect(() => {
    if (handledRef.current) return
    const current = localInfo?.commit
    if (!current || typeof window === 'undefined') return
    handledRef.current = true

    const seen = readLastSeenCommit()
    if (seen === current) return

    fetchChangelog()
      .then((changelog) => {
        const newEntries = seen
          ? getEntriesSince(changelog, seen)
          : getEntriesSinceLastTag(changelog)
        // 展示即标记已看:保证同一版本只展示一次
        writeLastSeenCommit(current)
        if (newEntries.length > 0) {
          setEntries(newEntries)
          setVisible(true)
        }
      })
      .catch(() => {
        // 加载失败不标记已看,下次加载重试
      })
  }, [localInfo])

  const close = useCallback(() => setVisible(false), [])

  if (!visible || !entries) return null

  const shown = entries.slice(0, MAX_VISIBLE_ENTRIES)
  const hasMore = entries.length > MAX_VISIBLE_ENTRIES

  return (
    <div
      data-testid="update-changelog-notice"
      className={cn(
        'fixed right-6 z-[55] w-[340px] max-w-[calc(100vw-3rem)] rounded-lg bg-background overflow-hidden shadow-[var(--shadow-card),var(--shadow-card-inner)] animate-in fade-in slide-in-from-bottom-2 duration-200 transition-[bottom] duration-200',
        toastVisible ? 'bottom-24' : 'bottom-6',
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="flex-1 text-sm font-semibold tracking-tight">
          {t('version.updateChangelogTitle')}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={close}
          aria-label={t('common.close')}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <ul className="max-h-56 overflow-y-auto px-4 py-2.5 space-y-3">
        {shown.map((entry, index) => (
          <li key={entry.commit || index} className="text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.version && (
                <Badge variant="secondary" className="font-mono">
                  {entry.version}
                </Badge>
              )}
              {entry.forceUpdate && (
                <Badge variant="destructive">{t('version.forcedRelease')}</Badge>
              )}
              {entry.commit && (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {entry.commit}
                </span>
              )}
              {entry.commitTime && (
                <span className="text-xs text-muted-foreground">
                  {formatTime(entry.commitTime)}
                </span>
              )}
            </div>
            {entry.message && (
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap leading-snug">
                {entry.message}
              </p>
            )}
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="px-4 pb-3.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => router.push(`/${locale}/update`)}
          >
            {t('version.viewFullChangelog')}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
