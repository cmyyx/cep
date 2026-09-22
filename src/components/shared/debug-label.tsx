'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Floating debug console label.
 *
 * Renders a small button at the bottom-right of the viewport.
 * Auto-hides when page finishes loading with a fade-out transition.
 * Click opens the debug console panel.
 *
 * The 7-click gesture works independently via the <head> inline bootstrap
 * script — this label is only a visual hint. The gesture is available from
 * the first frame regardless of whether this component has rendered.
 *
 * Labels and strings in this component are intentionally hardcoded in
 * English — this is a developer tool, not a user-facing UI, and should
 * remain readable regardless of the user's locale setting.
 */
export function DebugLabel() {
  const [mounted, setMounted] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    // Trigger fade-in on next paint so the transition animates
    const raf = requestAnimationFrame(() => setMounted(true))

    let hideTimer: ReturnType<typeof setTimeout> | undefined
    let removeTimer: ReturnType<typeof setTimeout> | undefined
    let idleHandle: number | undefined
    let warmTimer: ReturnType<typeof setTimeout> | undefined

    // Warm /debug-panel.js during idle so a click opens the panel instantly.
    // The download no longer sits on the critical path (guards.js also loads it
    // on demand), so this is purely a first-click latency optimisation.
    // Optional call guards against a stale cached guards.js from a previous
    // deploy that predates preloadPanel.
    const warmPanel = () => {
      const preload = () => { window.__cep_debug__?.preloadPanel?.() }
      if (typeof requestIdleCallback === 'function') {
        idleHandle = requestIdleCallback(preload, { timeout: 2000 })
      } else {
        warmTimer = setTimeout(preload, 1500)
      }
    }

    const onLoad = () => {
      hideTimer = setTimeout(() => setHiding(true), 0)
      removeTimer = setTimeout(() => setRemoved(true), 700)
      warmPanel()
    }

    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
    }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hideTimer)
      clearTimeout(removeTimer)
      clearTimeout(warmTimer)
      if (idleHandle !== undefined) cancelIdleCallback(idleHandle)
      window.removeEventListener('load', onLoad)
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
        'fixed bottom-3 right-3 z-[2147483647]',
        'rounded-md px-2.5 py-1 h-auto',
        'text-[13px] font-medium tracking-[0.5px]',
        'bg-black/55 text-white shadow-[0px_0px_0px_1px_rgba(255,255,255,0.2)]',
        'transition-opacity duration-700',
        mounted && !hiding ? 'opacity-100' : 'opacity-0',
        // Keep ghost variant hover appearance consistent with the dark label
        'hover:bg-black/65 hover:text-white',
      )}
      onClick={(e) => {
        e.stopPropagation()
        window.__cep_debug__?.openPanel?.()
      }}
    >
      Debug Console
    </Button>
  )
}
