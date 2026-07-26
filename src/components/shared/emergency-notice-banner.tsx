'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertOctagon, AlertTriangle, ExternalLink, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  isNoticeVisibleForLocale,
  pickLocalizedText,
} from '@/lib/bootstrap-notice'
import {
  getNoticeServerSnapshot,
  getNoticeSnapshot,
  startNoticePolling,
  subscribeNotice,
} from '@/lib/notice-store'
import type { BootstrapNoticeLevel } from '@/types/bootstrap'

/** 三档等级的视觉分档: 底色 + 文字色 + 图标 + 字重, 边框统一用 inset shadow 表达。 */
const LEVEL_CLASSES: Record<BootstrapNoticeLevel, string> = {
  info: 'bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100',
  warning: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
  critical: 'bg-red-50 text-red-900 dark:bg-red-950/70 dark:text-red-50',
}

const LEVEL_ICONS: Record<BootstrapNoticeLevel, React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
}

const LEVEL_TITLE_CLASSES: Record<BootstrapNoticeLevel, string> = {
  info: 'font-medium',
  warning: 'font-medium',
  critical: 'font-semibold',
}

export function EmergencyNoticeBanner() {
  const t = useTranslations()
  const locale = useLocale()
  // 两个来源 (bootstrap.js 注入值/事件 + notice.json 轮询) 都收敛到 notice-store,
  // "最后到达者生效"; 这里只消费解析好的公告。
  const notice = useSyncExternalStore(
    subscribeNotice,
    getNoticeSnapshot,
    getNoticeServerSnapshot
  )
  // 轮询只能在浏览器里跑 (document / fetch), 卸载时连同定时器与监听一起撤掉。
  useEffect(() => startNoticePolling(), [])

  if (!notice) return null
  // 前向兼容: 后端将来给公告加 locales 定向, 命中不了当前语言就不渲染。
  if (!isNoticeVisibleForLocale(notice, locale)) return null

  const title = pickLocalizedText(notice.title, locale)
  if (!title) return null
  const body = pickLocalizedText(notice.body, locale)
  const linkLabel = pickLocalizedText(notice.linkLabel, locale) ?? t('common.viewDetails')
  const isCritical = notice.level === 'critical'
  const LevelIcon = LEVEL_ICONS[notice.level]
  const isExternalLink = Boolean(notice.linkUrl && !notice.linkUrl.startsWith('/'))

  return (
    <div
      data-nosnippet
      data-level={notice.level}
      role={isCritical ? 'alert' : 'status'}
      aria-live={isCritical ? 'assertive' : 'polite'}
      className={cn(
        'flex shrink-0 items-start gap-2.5 px-4 py-2.5 text-sm',
        'shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]',
        LEVEL_CLASSES[notice.level]
      )}
    >
      {isCritical ? (
        <span className="relative mt-1.5 flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
      ) : null}
      <LevelIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('leading-relaxed', LEVEL_TITLE_CLASSES[notice.level])}>{title}</p>
        {body ? <p className="text-[13px] leading-relaxed opacity-80">{body}</p> : null}
      </div>
      {notice.linkUrl ? (
        <Button
          nativeButton={false}
          size="sm"
          variant="outline"
          className="shrink-0 bg-transparent"
          render={
            <a
              href={notice.linkUrl}
              {...(isExternalLink
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            />
          }
        >
          {isExternalLink ? <ExternalLink data-icon="inline-start" /> : null}
          {linkLabel}
        </Button>
      ) : null}
    </div>
  )
}
