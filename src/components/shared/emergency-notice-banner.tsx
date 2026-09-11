'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isNoticeVisibleForLocale, pickLocalizedText } from '@/lib/bootstrap-notice'
import {
  dismissNotice,
  getDismissedSignatureServerSnapshot,
  getDismissedSignatureSnapshot,
  noticeSignature,
  subscribeNoticeDismiss,
} from '@/lib/notice-dismiss'
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

/**
 * 折叠时保留的正文行数 (2 行)。正文是唯一可能无限长的字段 (管理端上限 4096 字节),
 * 必须默认截断, 否则一条长公告会在移动端把整页内容挤出视口。
 *
 * 写成字面量而不是 `line-clamp-${n}`: Tailwind 只扫描源码里完整的类名, 拼接出来的
 * 类名不会被生成。
 */
const COLLAPSED_BODY_CLASS = 'line-clamp-2'

/**
 * 展开后的正文高度上限。横幅挂在滚动壳之外 (见 layout.tsx), 不设上限的话展开就是
 * 又一个"内容过多直接超出屏幕"; 超过这个高度改为内部滚动。40svh 加上标题行与操作
 * 行, 整条横幅在手机上约占半屏。
 */
const EXPANDED_MAX_HEIGHT = 'max-h-[40svh]'

/** 退场动画时长, 与 animate-toast-out 的 200ms 对齐。 */
const EXIT_ANIMATION_MS = 200

/** 操作行与正文左对齐: 图标 size-4 (16px) + gap-2.5 (10px)。 */
const ACTIONS_INDENT = 'pl-[26px]'

export function EmergencyNoticeBanner() {
  const t = useTranslations()
  const locale = useLocale()
  // 公告状态由 notice-store 统一管理；页面初始化和运行期间均从这里消费。
  const notice = useSyncExternalStore(
    subscribeNotice,
    getNoticeSnapshot,
    getNoticeServerSnapshot
  )
  // 关闭态单独一个 store: 公告变了要重新解析, 关闭态变了只需要重渲染。
  const dismissedSignature = useSyncExternalStore(
    subscribeNoticeDismiss,
    getDismissedSignatureSnapshot,
    getDismissedSignatureServerSnapshot
  )
  // 轮询只能在浏览器里跑 (document / fetch), 卸载时连同定时器与监听一起撤掉。
  useEffect(() => startNoticePolling(), [])

  // 展开态与退场态都用"公告身份"做键而不是布尔值: 换公告时身份变了, 两个状态自动
  // 失效, 不需要在 effect 里 setState 重置 (那会引发级联渲染)。这也顺手堵掉了
  // "上一条正在播退场动画时轮询换上了新公告"的串味。
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [exitingKey, setExitingKey] = useState<string | null>(null)
  const [bodyOverflows, setBodyOverflows] = useState(false)
  const bodyRef = useRef<HTMLParagraphElement | null>(null)

  const signature = notice ? noticeSignature(notice) : null
  const title = notice ? pickLocalizedText(notice.title, locale) : undefined
  const body = notice ? pickLocalizedText(notice.body, locale) : undefined
  const expanded = signature !== null && expandedKey === signature
  const exiting = signature !== null && exitingKey === signature

  // 只有真的超出 2 行才给"展开"。按字符数猜会在中日英之间误判, 所以量 scrollHeight。
  // 不必在换公告时重置 bodyOverflows: 正文文案没变, 溢出结论也不会变; 文案变了这个
  // effect 会因为 body 变化重新测量, 展开态被收起时也会因 expanded 变化重测。
  useEffect(() => {
    if (expanded || !body) return
    const element = bodyRef.current
    if (!element) return
    let cancelled = false
    const measure = () => {
      if (cancelled) return
      // +1 容忍亚像素: 行高不是整数时 scrollHeight 会略大于 clientHeight。
      setBodyOverflows(element.scrollHeight > element.clientHeight + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    // 字体晚到会改变行高, 量一次补正; jsdom 里没有 document.fonts。
    if (document.fonts) void document.fonts.ready.then(measure)
    return () => {
      cancelled = true
      window.removeEventListener('resize', measure)
    }
  }, [expanded, body])

  // 退场动画只是收尾: 关闭意图在点击那一刻就已经落库 (见 handleDismiss), 这里只负责
  // 在动画跑完后把状态收回来, 让横幅真正从布局里消失。
  //
  // 刻意不写成"动画结束后再写入关闭态": 那样写入被推迟到一个定时器里, 如果中途轮询
  // 换了公告, 定时器会拿着旧闭包把新公告关掉 —— 访客会莫名其妙地看不到新公告。
  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(() => setExitingKey(null), EXIT_ANIMATION_MS)
    return () => window.clearTimeout(timer)
  }, [exiting])

  if (!notice) return null
  // 前向兼容: 后端将来给公告加 locales 定向, 命中不了当前语言就不渲染。
  if (!isNoticeVisibleForLocale(notice, locale)) return null
  if (!title) return null
  // 关过这条公告就整条不渲染 —— 连图标都不留, 让页面彻底回到原样。exiting 期间仍然
  // 渲染, 否则退场动画永远看不到。
  const isDismissed = dismissedSignature !== null && dismissedSignature === signature
  if (isDismissed && !exiting) return null

  const isCritical = notice.level === 'critical'
  const LevelIcon = LEVEL_ICONS[notice.level]
  const linkLabel = pickLocalizedText(notice.linkLabel, locale) ?? t('common.viewDetails')
  const isExternalLink = Boolean(notice.linkUrl && !notice.linkUrl.startsWith('/'))
  const hasActions = bodyOverflows || Boolean(notice.linkUrl)

  const handleDismiss = () => {
    // 先落库再播动画: 关闭是访客的意图, 不该取决于动画有没有跑完。
    dismissNotice(notice)
    setExitingKey(signature)
  }

  return (
    <div
      data-nosnippet
      data-level={notice.level}
      role={isCritical ? 'alert' : 'status'}
      aria-live={isCritical ? 'assertive' : 'polite'}
      className={cn(
        'shrink-0 px-4 py-2.5 text-sm',
        'shadow-[var(--shadow-border-inset-b)] transition-all duration-200',
        LEVEL_CLASSES[notice.level],
        exiting && 'animate-toast-out opacity-0'
      )}
    >
      <div className="flex items-start gap-2.5">
        {isCritical ? (
          <span className="relative mt-1.5 flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
        ) : null}
        <LevelIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={cn('leading-relaxed', LEVEL_TITLE_CLASSES[notice.level])}>{title}</p>
          {body ? (
            <p
              ref={bodyRef}
              className={cn(
                'text-[13px] leading-relaxed opacity-80',
                expanded
                  ? cn(EXPANDED_MAX_HEIGHT, 'overflow-y-auto')
                  : COLLAPSED_BODY_CLASS
              )}
            >
              {body}
            </p>
          ) : null}
        </div>
        {/* 关闭按钮留在标题行: 它是唯一必须始终可点的东西, 不能随正文一起被折叠或滚动。 */}
        {notice.dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label={t('common.close')}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {/*
        展开开关与链接按钮共用底部一行, 而不是挤在正文右侧: 放右侧会让每一行正文都
        少掉按钮的宽度, 窄屏上正文会变成一条细柱。放底部后正文始终占满整行宽度。
      */}
      {hasActions ? (
        <div className={cn('mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5', ACTIONS_INDENT)}>
          {bodyOverflows ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              aria-expanded={expanded}
              onClick={() => setExpandedKey(expanded ? null : signature)}
              className="h-auto px-0 text-xs text-current opacity-80 hover:opacity-100"
            >
              {expanded ? t('notice.collapse') : t('notice.expand')}
              {expanded ? (
                <ChevronUp className="size-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-3" aria-hidden="true" />
              )}
            </Button>
          ) : null}
          {notice.linkUrl ? (
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              className="max-w-full min-w-0 bg-transparent"
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
              {/* 长文案省略而不是撑宽: 否则一个长链接文案又会把整行吃掉。 */}
              <span className="truncate">{linkLabel}</span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
