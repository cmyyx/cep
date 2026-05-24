'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface PreviewToggleProps {
  data: unknown
  onToggle?: () => void
}

export default function PreviewToggle({ data, onToggle }: PreviewToggleProps) {
  const [expanded, setExpanded] = useState(false)
  if (data === null || data === undefined || typeof data !== 'object') return null

  const handleToggle = () => {
    setExpanded(!expanded)
    onToggle?.()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-0.5 shrink-0"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggle() }}
        tabIndex={-1}
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </Button>
      {expanded && (
        <div className="w-full mt-1 mb-1">
          <pre className="max-h-40 overflow-y-auto text-[11px] leading-relaxed bg-muted/30 rounded-lg p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </>
  )
}
