'use client'

import { useEffect, useRef } from 'react'
import { List } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export interface WikiTocItem {
  id: string
  label: string
}

export interface WikiDetailTocProps {
  items: WikiTocItem[]
  activeId: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onNavigate: (id: string) => void
}

export function WikiDetailToc({ items, activeId, expanded, onExpandedChange, onNavigate }: WikiDetailTocProps) {
  const t = useTranslations()
  const isMobile = useIsMobile()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) onExpandedChange(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [expanded, onExpandedChange])

  if (items.length === 0) return null

  return (
    <div
      ref={panelRef}
      data-wiki-toc-panel
      data-expanded={expanded}
      className={cn(
        'pointer-events-auto fixed top-[38%] z-40 flex w-64 -translate-y-1/2 items-start overflow-visible opacity-95 [filter:drop-shadow(0_0_1px_rgba(0,0,0,0.16))_drop-shadow(0_2px_2px_rgba(0,0,0,0.06))] transition-[right] duration-300 ease-out hover:opacity-100 sm:top-1/2',
        expanded ? 'right-0' : '-right-54',
      )}
      onPointerEnter={() => {
        if (!isMobile) onExpandedChange(true)
      }}
      onPointerLeave={() => {
        if (!isMobile) onExpandedChange(false)
      }}
    >
      <Button
        type="button"
        variant="ghost"
        className="relative z-10 -mr-px h-16 w-10 shrink-0 flex-col gap-1 rounded-l-lg rounded-r-none border-0 bg-popover bg-clip-border px-0 py-1.5"
        aria-label={t('wiki.tableOfContents')}
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
      >
        <List className="size-4" />
        <span className="text-[11px] tracking-[0.18em] [writing-mode:vertical-rl]">{t('wiki.contentsRail')}</span>
      </Button>
      <nav
        aria-hidden={!expanded}
        className={cn(
          'relative z-0 min-w-0 flex-1 self-start space-y-0.5 overflow-y-auto bg-popover p-2',
          !expanded && 'pointer-events-none',
        )}
      >
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <Button
              key={item.id}
              render={<a href={`#${item.id}`} tabIndex={expanded ? 0 : -1} aria-current={active ? 'location' : undefined} />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className={cn('w-full justify-start', active && 'bg-accent text-accent-foreground')}
              onClick={(event) => {
                event.preventDefault()
                onNavigate(item.id)
              }}
            >
              {item.label}
            </Button>
          )
        })}
      </nav>
    </div>
  )
}

export default WikiDetailToc
