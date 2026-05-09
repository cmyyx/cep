'use client'

import React, { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Megaphone, ChevronRight, ImageOff, XIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAnnouncementStore, useImportantUnreadCount } from '@/stores/useAnnouncementStore'
import { cn } from '@/lib/utils'
import type { Announcement } from '@/types/announcement'

function AnnouncementItem({
  announcement,
  isRead,
  onOpen,
}: {
  announcement: Announcement
  isRead: boolean
  onOpen: () => void
}) {
  const t = useTranslations()
  const isImportant = announcement.priority === 'important'

  const dateStr = (() => {
    try {
      const d = new Date(announcement.publishTime)
      if (isNaN(d.getTime())) return ''
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d)
    } catch {
      return ''
    }
  })()

  return (
    <Button
      variant="ghost"
      onClick={onOpen}
      className={cn(
        'w-full justify-start h-auto px-3 py-2.5 -mx-3 rounded-md transition-colors',
        'flex items-start gap-3',
        isImportant && !isRead && 'bg-amber-50/50 dark:bg-amber-950/30',
        isImportant && isRead && 'bg-transparent',
        !isImportant && 'hover:bg-muted/50',
        isImportant && 'hover:bg-amber-50 dark:hover:bg-amber-950/40'
      )}
    >
      {!isRead && isImportant && (
        <div className="mt-1.5 h-2 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
      )}
      {!isRead && !isImportant && (
        <div className="mt-1.5 h-2 w-1 shrink-0 rounded-full bg-develop-blue" aria-hidden="true" />
      )}
      {isRead && <div className="w-1 shrink-0" aria-hidden="true" />}

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              !isRead && isImportant && 'font-semibold text-foreground',
              !isRead && !isImportant && 'font-medium text-foreground',
              isRead && 'font-medium text-muted-foreground'
            )}
          >
            {announcement.title}
          </span>
          {isImportant && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800">
              {t('home.importantBadge')}
            </Badge>
          )}
        </div>
        {dateStr && <p className="text-xs text-muted-foreground">{dateStr}</p>}
      </div>

      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50" />
    </Button>
  )
}

const IMAGE_MIN_HEIGHT = 'min-h-[60px]'

/** Image with stable container — error shares placeholder dimensions, loaded image flows naturally */
function MarkdownImage({
  src,
  alt,
  errorLabel,
}: {
  src?: string
  alt?: string
  errorLabel: string
}) {
  const [error, setError] = useState(false)
  const srcStr = typeof src === 'string' && src.length > 0 ? src : undefined

  if (error || !srcStr) {
    return (
      <span
        className={cn(
          'flex items-center gap-2 my-3 px-3 py-2 rounded-lg bg-muted text-xs text-muted-foreground',
          IMAGE_MIN_HEIGHT
        )}
      >
        <ImageOff className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {errorLabel}
          {alt ? `：${alt}` : ''}
        </span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'block my-3 overflow-hidden rounded-lg bg-muted',
        IMAGE_MIN_HEIGHT
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={srcStr}
        alt={alt || ''}
        className="block max-w-full h-auto rounded-lg"
        loading="lazy"
        onError={() => setError(true)}
      />
    </span>
  )
}

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'img'],
  attributes: {
    ...defaultSchema.attributes,
    img: ['src', 'alt', 'title', 'loading', 'className'],
  },
}

const MarkdownContent = memo(function MarkdownContent({
  content,
  imageErrorLabel,
}: {
  content: string
  imageErrorLabel: string
}) {
  const components = useMemo(
    () => ({
      img: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} errorLabel={imageErrorLabel} />
      ),
    }),
    [imageErrorLabel]
  )

  return (
    <div
      className={cn(
        'text-sm text-muted-foreground leading-relaxed space-y-3',
        '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1.5',
        '[&_p]:leading-relaxed',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5',
        '[&_li]:leading-relaxed',
        '[&_a]:text-develop-blue [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono',
        '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:font-mono [&_pre]:my-3',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-amber-300 dark:[&_blockquote]:border-amber-700 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground'
      )}
    >
      <ReactMarkdown
        components={components}
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

export function AnnouncementPanel() {
  const t = useTranslations()
  const [detail, setDetail] = useState<Announcement | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const announcements = useAnnouncementStore((s) => s.announcements)
  const readIds = useAnnouncementStore((s) => s.readIds)
  const isLoading = useAnnouncementStore((s) => s.isLoading)
  const loadAnnouncements = useAnnouncementStore((s) => s.loadAnnouncements)
  const markAsRead = useAnnouncementStore((s) => s.markAsRead)
  const importantUnread = useImportantUnreadCount()

  const totalUnread = announcements.filter((a) => !readIds.includes(a.id)).length

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  const handleOpen = useCallback(
    (a: Announcement) => {
      setDetail(a)
      setDialogOpen(true)
      markAsRead(a.id)
    },
    [markAsRead]
  )

  const handleClose = useCallback(() => {
    setDialogOpen(false)
  }, [])

  return (
    <div id="announcement-panel" className="space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold tracking-[-0.32px] text-foreground">
          {t('home.announcements')}
        </h3>
        {totalUnread > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              'h-4 px-1.5 text-[10px] leading-none',
              importantUnread > 0 &&
                'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            )}
          >
            {totalUnread}
          </Badge>
        )}
      </div>

      {/* Announcement list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-3 py-4 space-y-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <Skeleton className="mt-1.5 h-2 w-1 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('home.noAnnouncements')}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {announcements.map((a) => (
                <AnnouncementItem
                  key={a.id}
                  announcement={a}
                  isRead={readIds.includes(a.id)}
                  onOpen={() => handleOpen(a)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog — uses DialogContent for proper focus trap, Esc key, and accessibility */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        {detail && (
          <DialogContent className="sm:max-w-lg duration-200" showCloseButton={false}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2"
              onClick={handleClose}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>

            <DialogHeader>
              <div className="flex items-center gap-2">
                {detail.priority === 'important' && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] leading-none text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800">
                    {t('home.importantBadge')}
                  </Badge>
                )}
                <DialogTitle>{detail.title}</DialogTitle>
              </div>
              <DialogDescription>
                {(() => {
                  try {
                    const d = new Date(detail.publishTime)
                    if (isNaN(d.getTime())) return ''
                    return t('home.publishedAt', {
                      time: new Intl.DateTimeFormat(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(d),
                    })
                  } catch {
                    return ''
                  }
                })()}
              </DialogDescription>
            </DialogHeader>

            <MarkdownContent
              content={detail.content}
              imageErrorLabel={t('home.imageLoadFailed')}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
