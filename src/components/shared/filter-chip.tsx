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
              'w-full px-1 py-0.5 rounded text-[11px] text-center border transition-colors bg-muted/60 h-auto min-h-0 min-w-0',
              isSelected && 'bg-primary text-primary-foreground border-primary',
              !isSelected && isValid && 'border-border hover:border-foreground/40 hover:bg-muted/80',
              !isValid &&
                !isSelected &&
                'border-border/60 text-muted-foreground/40 line-through cursor-not-allowed',
            )}
          />
        }
      >
        {/* Visible truncated text */}
        <span ref={visibleRef} className="truncate min-w-0">
          {displayText}
        </span>
        {/* Hidden measurement copy: identical font, no clipping, out of flow */}
        <span
          ref={measureRef}
          aria-hidden="true"
          className="absolute invisible whitespace-nowrap pointer-events-none"
          style={{ font: 'inherit' }}
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
