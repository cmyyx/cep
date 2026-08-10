'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface MergedValueProps {
  value: ReactNode
  /** rowSpan 值: > 1 时合并值在 sticky 表头下方钉住。 */
  span: number
}

/** 合并值在 sticky 表头下方钉住 (配合 --table-header-h, 见 merged-level-table)。 */
export function MergedValue({ value, span }: MergedValueProps) {
  return (
    <span className={cn('inline-flex min-h-10 items-center px-2 py-2', span > 1 && 'sticky top-[var(--table-header-h,2.5rem)]')}>
      {value}
    </span>
  )
}

export default MergedValue
