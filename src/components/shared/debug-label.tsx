'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Floating debug console label.
 *
 * Renders a small button at the bottom-right of the viewport.
 * Auto-hides after 3 seconds with a fade-out transition.
 * Click opens the debug console panel.
 *
 * The 7-click gesture works independently via the <head> inline bootstrap
 * script — this label is only a visual hint. The gesture is available from
 * the first frame regardless of whether this component has rendered.
 */
export function DebugLabel() {
  const [mounted, setMounted] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [removed, setRemoved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    // Trigger fade-in on next paint so the transition animates
    const raf = requestAnimationFrame(() => setMounted(true))

    timerRef.current = setTimeout(() => setHiding(true), 3000)

    const removeTimer = setTimeout(() => setRemoved(true), 3700)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timerRef.current)
      clearTimeout(removeTimer)
    }
  }, [])

  if (removed) return null

  return (
    <Button
      data-debug="label"
      variant="ghost"
      size="sm"
      aria-label="Debug Console"
      className={cn(
        'fixed bottom-3 right-3 z-[9999]',
        'rounded-md px-2.5 py-1 h-auto',
        'text-[13px] font-medium tracking-[0.5px]',
        'bg-black/55 text-white border border-white/20',
        'transition-opacity duration-700',
        mounted && !hiding ? 'opacity-100' : 'opacity-0',
        // Keep ghost variant hover appearance consistent with the dark label
        'hover:bg-black/65 hover:text-white',
      )}
      onClick={(e) => {
        e.stopPropagation()
        // @ts-expect-error __cep_debug__.openPanel set by inline bootstrap script
        window.__cep_debug__?.openPanel?.()
      }}
    >
      Debug Console
    </Button>
  )
}
