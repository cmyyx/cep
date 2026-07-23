'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMobileLongPressTooltip } from '@/hooks/use-mobile-long-press-tooltip'
import { cn } from '@/lib/utils'

/** Shared surface styles for dense planner / picker preview tooltips. */
export function plannerPreviewTooltipContentClassName(isMobile: boolean) {
  return cn(
    'max-h-[min(var(--available-height),calc(100svh-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain bg-popover p-3 text-popover-foreground shadow-[var(--shadow-card)]',
    isMobile && 'data-closed:animate-none',
  )
}

export interface PlannerPreviewTooltipProps {
  /** When false or content is empty, renders the card without tooltip chrome. */
  enabled?: boolean
  content?: ReactNode | null
  onClick: () => void
  className?: string
  'aria-label'?: string
  'aria-pressed'?: boolean
  children: ReactNode
}

/**
 * Dense-grid entity card with desktop hover delay (via TooltipProvider)
 * and mobile long-press preview. Long-press release does not fire onClick.
 */
export function PlannerPreviewTooltip({
  enabled = true,
  content,
  onClick,
  className,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
  children,
}: PlannerPreviewTooltipProps) {
  const active = Boolean(enabled && content != null && content !== false)
  const {
    open,
    triggerRef,
    handleOpenChange,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleContextMenu,
    swallowLongPressClick,
    isMobile,
  } = useMobileLongPressTooltip(active)

  const handleClick = () => {
    if (swallowLongPressClick()) return
    onClick()
  }

  const trigger = (
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      size="card"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={handleClick}
      onPointerDown={isMobile && active ? handlePointerDown : undefined}
      onPointerMove={isMobile && active ? handlePointerMove : undefined}
      onPointerUp={isMobile && active ? handlePointerEnd : undefined}
      onPointerCancel={isMobile && active ? handlePointerEnd : undefined}
      onContextMenu={isMobile && active ? handleContextMenu : undefined}
      className={cn(
        active && isMobile && 'touch-manipulation select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [&_img]:pointer-events-none [&_img]:select-none',
        className,
      )}
    >
      {children}
    </Button>
  )

  if (!active) return trigger

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger render={trigger} />
      <TooltipContent
        side={isMobile ? 'bottom' : 'top'}
        sideOffset={8}
        collisionPadding={16}
        className={plannerPreviewTooltipContentClassName(isMobile)}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export default PlannerPreviewTooltip
