'use client'

import { useEffect } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { cn } from '@/lib/utils'

/**
 * Thin progress bar at the top of <main> — appears immediately on every
 * sidebar navigation, no debounce.
 *
 * Uses `transform: scaleX()` instead of `width` to stay on the GPU
 * compositing layer (no layout thrashing). Glow is applied via
 * `drop-shadow` filter which doesn't contribute to the element's box
 * size, preventing scrollbar flicker from shadow overflow.
 *
 * Lifecycle:
 *   isProgressing  → CSS animation scaleX(0)→scaleX(0.9)
 *   isCompleting   → CSS animation scaleX(0.9)→scaleX(1) + fade out
 *                    then calls resetProgress() after the animation ends
 */
export function NavigationProgressBar() {
  const isProgressing = useNavigationStore((s) => s.isProgressing)
  const isCompleting = useNavigationStore((s) => s.isCompleting)
  const targetLabel = useNavigationStore((s) => s.targetLabel)
  const navigateStartTime = useNavigationStore((s) => s.navigateStartTime)
  const resetProgress = useNavigationStore((s) => s.resetProgress)

  const started = navigateStartTime !== null

  // When isCompleting flips to true, schedule a reset after the
  // CSS animation finishes (350ms matches nav-progress-done duration).
  useEffect(() => {
    if (!isCompleting) return
    const timer = setTimeout(resetProgress, 350)
    return () => clearTimeout(timer)
  }, [isCompleting, resetProgress])

  return (
    <div
      className={cn(
        'absolute top-0 left-0 right-0 z-51 h-[2px] pointer-events-none overflow-hidden',
        'transition-opacity duration-200 ease-out',
        started ? 'opacity-100' : 'opacity-0'
      )}
      role="progressbar"
      aria-label={targetLabel ?? undefined}
      aria-hidden={!started}
    >
      {/* Fill bar — always 100% wide, animated via transform: scaleX */}
      <div
        className={cn(
          'h-full w-full origin-left bg-gradient-to-r from-develop-blue via-preview-pink to-ship-red',
          'rounded-full',
          // Glow via filter — does not affect box size, no scrollbar flicker
          started && 'drop-shadow-[0_0_6px_rgba(10,114,239,0.35)]',
          isProgressing
            ? 'animate-[nav-progress-fill_1.2s_cubic-bezier(0.4,0,0.2,1)_forwards]'
            : isCompleting
              ? 'animate-[nav-progress-done_0.35s_ease-out_forwards]'
              : ''
        )}
        style={
          !started
            ? { transform: 'scaleX(0)' }
            : undefined
        }
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 animate-[progress-shimmer_1.5s_ease-in-out_infinite]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.5) 70%, transparent 100%)',
          }}
        />
      </div>
    </div>
  )
}
