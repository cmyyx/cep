'use client'

import { memo, useState, useRef, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface FilterChipProps {
  value: string
  label?: string
  isValid: boolean
  isSelected: boolean
  disabled?: boolean
  onToggle: () => void
  /** Optional render prop for tooltip content (defaults to displayText). */
  tooltipContent?: (displayText: string) => ReactNode
}

/**
 * A filter chip button with conditional tooltip.
 *
 * Text truncation detection uses a hidden measurement <span> rendered by React —
 * same text, same font, no overflow clipping — compared via
 * getBoundingClientRect().width for sub-pixel precision.
 * Zero direct DOM API calls (no createRange, no createElement, no querySelector).
 */
export const FilterChip = memo(function FilterChip({
  value,
  label,
  isValid,
  isSelected,
  disabled,
  onToggle,
  tooltipContent,
}: FilterChipProps) {
  const visibleRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const displayText = label ?? value

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Suppress tooltip when text fits without truncation.
      // Compare the measurement span (unclipped full text) against the
      // visible container — both via getBoundingClientRect for float precision.
      if (open && visibleRef.current && measureRef.current) {
        const textWidth = measureRef.current.getBoundingClientRect().width
        const containerWidth = visibleRef.current.getBoundingClientRect().width
        if (textWidth <= containerWidth) {
          return
        }
      }
      setTooltipOpen(open)
    },
    [],
  )

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleOpenChange}>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled ?? (!isValid && !isSelected)}
            onClick={onToggle}
            aria-pressed={isSelected}
            className={cn(
              // min-h-6 keeps the tap target at the WCAG 2.5.8 minimum (24x24 CSS px);
              // `size="xs"` alone collapses to ~18px once h-auto overrides its h-6.
              'w-full px-1 py-1 rounded text-[11px] text-center transition-colors bg-muted/60 h-auto min-h-6 min-w-0 shadow-[var(--shadow-border)]',
              // hover:bg-primary! 覆盖 Button ghost 的 hover:bg-muted, 选中态 hover 不变色
              isSelected && 'bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--color-primary)] hover:bg-primary! hover:text-primary-foreground!',
              !isSelected && isValid && 'hover:shadow-[var(--shadow-border-strong)] hover:bg-muted/80',
              !isValid &&
                !isSelected &&
                'shadow-[var(--shadow-border)] text-muted-foreground/70 line-through cursor-not-allowed',
            )}
          />
        }
      >
        {/* Visible truncated text */}
        <span ref={visibleRef} className="truncate min-w-0">
          {displayText}
        </span>
        {/* Hidden measurement copy: identical font (inherited from parent),
            no clipping, out of flow */}
        <span
          ref={measureRef}
          aria-hidden="true"
          className="absolute invisible whitespace-nowrap pointer-events-none"
        >
          {displayText}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltipContent ? tooltipContent(displayText) : displayText}
      </TooltipContent>
    </Tooltip>
  )
})
