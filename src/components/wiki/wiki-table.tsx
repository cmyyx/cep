'use client'

import type { ComponentProps } from 'react'
import { Table } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type WikiTableProps = ComponentProps<typeof Table>

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
