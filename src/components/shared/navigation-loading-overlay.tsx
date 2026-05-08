'use client'

import { useNavigationStore } from '@/stores/useNavigationStore'
import { cn } from '@/lib/utils'

/**
 * Full-area overlay shown during slow client-side navigations.
 *
 * Fade-in uses a CSS opacity transition so the overlay appears smoothly.
 * Fade-out is handled by CSS opacity transition as a fallback. View Transitions
 * provides the primary cross-fade; this transition covers browsers without VT
 * and the brief window after the VT snapshot is taken.
 */
export function NavigationLoadingOverlay() {
  const isNavigating = useNavigationStore((s) => s.isNavigating)
  const targetLabel = useNavigationStore((s) => s.targetLabel)

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm',
        'transition-opacity duration-200 ease-out',
        isNavigating
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none'
      )}
      aria-hidden={!isNavigating}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        {targetLabel && (
          <p className="text-sm text-muted-foreground">{targetLabel}</p>
        )}
      </div>
    </div>
  )
}
