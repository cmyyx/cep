'use client'

import { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { EquipCard } from './equip-card'
import { useRefinementStore } from '@/stores/useRefinementStore'
import type { Equip } from '@/types/refinement'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EquipSetGroupProps {
  setName: string
  equips: Equip[]
}

export const EquipSetGroup = memo(function EquipSetGroup({
  setName,
  equips,
}: EquipSetGroupProps) {
  const collapsedSets = useRefinementStore((s) => s.collapsedSets)
  const toggleSetCollapsed = useRefinementStore((s) => s.toggleSetCollapsed)
  const selectedEquipId = useRefinementStore((s) => s.selectedEquipId)

  const isCollapsed = collapsedSets[setName] ?? true

  const handleToggle = useCallback(() => {
    toggleSetCollapsed(setName)
  }, [toggleSetCollapsed, setName])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <Button
        type="button"
        variant="ghost"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 transition-colors h-auto"
      >
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform duration-200 shrink-0',
            !isCollapsed && 'rotate-180',
          )}
        />
        <h3 className="font-medium text-sm flex-1 text-left truncate">
          {setName}
        </h3>
        <span className="text-xs text-muted-foreground shrink-0">
          {equips.length}
        </span>
      </Button>

      {/* Body */}
      <div
        className={cn(
          'grid transition-all duration-200 ease-out',
          isCollapsed
            ? 'grid-rows-[0fr] opacity-0'
            : 'grid-rows-[1fr] opacity-100',
        )}
        aria-hidden={isCollapsed || undefined}
        {...(isCollapsed ? { inert: true as const } : {})}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2 p-3 pt-0">
            {equips.map((equip) => (
              <div key={equip.id} className="flex flex-col gap-0.5">
                <EquipCard
                  equip={equip}
                  isSelected={equip.id === selectedEquipId}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
