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
    // 表面必须不透明: sticky 首列/表头用 bg-card 遮挡滚过它们的单元格,
    // 若外框透明, 深色模式下 sticky 列 (#171717) 会与所在容器 (#0a0a0a) 明显错色。
    <div className="min-w-0 overflow-hidden rounded-md bg-card text-card-foreground shadow-[var(--shadow-border)]">
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
        // tbody 建立独立堆叠上下文 (relative z-0): 阻止滚动行内的合成层图片
        // (材料图标等) 在 Chrome 下绘制到 sticky 表头 (z-20) 之上, 造成"表头穿透"。
        '[&_th+th]:shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)] [&_td+td]:shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)] [&_tbody]:relative [&_tbody]:z-0',
        className,
      )}
      {...props}
    />
  )
}

export default WikiTable
