'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface LevelToggleProps {
  showAll: boolean
  onToggle: () => void
  collapseLabel: string
  expandLabel: string
}

/** 表格折叠/展开切换按钮 (等级/技能/武器表共用)。 */
export function LevelToggle({ showAll, onToggle, collapseLabel, expandLabel }: LevelToggleProps) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
      {showAll ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      {showAll ? collapseLabel : expandLabel}
    </Button>
  )
}

export default LevelToggle
