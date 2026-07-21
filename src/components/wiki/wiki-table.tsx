'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Table } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type WikiTableProps = ComponentProps<typeof Table>

export interface WikiTableFrameProps {
  children: ReactNode
  className?: string
  scrollClassName?: string
  footer?: ReactNode
}

export function WikiTableFrame({ children, className, scrollClassName, footer }: WikiTableFrameProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
      <div className={cn(
        'min-w-0 overflow-auto [scrollbar-gutter:stable] [&_[data-slot=table-container]]:overflow-visible',
        scrollClassName,
      )}>
        <div className={cn('min-w-max', className)}>{children}</div>
      </div>
      {footer ? (
        <div className="flex min-h-10 items-center justify-center bg-muted/35 px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.08)]">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function WikiTable({ className, ...props }: WikiTableProps) {
  return (
    <Table
      className={cn(
        '[&_th+th]:shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)] [&_td+td]:shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)]',
        className,
      )}
      {...props}
    />
  )
}

export default WikiTable
