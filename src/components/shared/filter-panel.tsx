'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FilterPanelProps {
  /** 折叠按钮标题。 */
  title: string
  collapsed: boolean
  onToggle: () => void
  /** 激活筛选计数 (0 或未传时不显示)。 */
  activeCount?: number
  /** 清除全部 (未传时不显示清除按钮)。 */
  onClear?: () => void
  clearLabel?: string
  children: ReactNode
}

/**
 * 可折叠筛选面板: 折叠按钮 + 激活计数/清除 + 展开/收起动画。
 * 五处筛选 (精锻 / 基质 / wiki 装备 / 面板预览 / 武器选择器) 共用的统一实现,
 * 展开动画用 grid-rows 0fr→1fr + opacity, 高度由内容自适应。
 */
export function FilterPanel({
  title,
  collapsed,
  onToggle,
  activeCount = 0,
  onClear,
  clearLabel,
  children,
}: FilterPanelProps) {
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn('size-4 transition-transform', collapsed ? '-rotate-90' : 'rotate-0')} />
        <span className="flex-1 text-left">{title}</span>
        {activeCount > 0 && <span className="font-geist-mono text-xs">{activeCount}</span>}
      </Button>
      {activeCount > 0 && onClear && clearLabel && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onClear}
          className="-mt-0.5 h-auto px-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {clearLabel}
        </Button>
      )}
      <div
        className={cn(
          'grid transition-all duration-200 ease-out',
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
      >
        {/* inert: 折叠时整个筛选子树不可交互/不可聚焦, 替代 aria-hidden (内容仍需被读屏读取)。 */}
        <div className="overflow-hidden" inert={collapsed || undefined}>
          <div className="mt-1.5 flex flex-col gap-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default FilterPanel
