/**
 * Global scroll lock for controlled tooltips.
 *
 * Per-trigger suppress only covers the card that was open when scroll started.
 * After scrolling, the pointer often sits on a *different* card — that instance
 * would instantly re-open (Base UI group timeout) and flash.
 *
 * Strategy:
 * 1. Capture-phase window listeners lock on every wheel/scroll (before hover
 *    retargeting opens another card).
 * 2. Subscribers (open tooltips) force-close when the lock engages.
 * 3. While locked, handleOpenChange(true) is ignored.
 */

const CLEAR_AFTER_MS = 400

let locked = false
let clearTimer: ReturnType<typeof setTimeout> | null = null
let installed = false
const closeListeners = new Set<() => void>()

function scheduleUnlock(durationMs: number): void {
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = setTimeout(() => {
    locked = false
    clearTimer = null
  }, durationMs)
}

/**
 * Engage the lock and notify subscribers to close. Safe to call often —
 * each call extends the unlock debounce.
 */
export function lockTooltipsForScroll(durationMs = CLEAR_AFTER_MS): void {
  const wasLocked = locked
  locked = true
  scheduleUnlock(durationMs)
  // Always notify so any tip that opened in the same frame also closes.
  // First lock + subsequent scroll ticks both force-close.
  if (!wasLocked || closeListeners.size > 0) {
    closeListeners.forEach((listener) => {
      try {
        listener()
      } catch {
        // ignore subscriber errors
      }
    })
  }
}

export function isTooltipScrollLocked(): boolean {
  return locked
}

/** Open tooltips register a close callback for capture-phase scroll lock. */
export function subscribeTooltipScrollClose(onClose: () => void): () => void {
  closeListeners.add(onClose)
  return () => {
    closeListeners.delete(onClose)
  }
}

/**
 * Install once at module load (client). Capture phase runs before target
 * hover retargeting so a new card under the cursor cannot flash open.
 */
export function ensureTooltipScrollLockInstalled(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const onScrollIntent = (event: Event) => {
    const target = event.target
    // Long planner previews scroll inside the popup; do not lock/close for that.
    if (target instanceof Element && target.closest('[data-slot="tooltip-content"]')) return
    // Some browsers target Document/Text for wheel; walk to parent Element when needed.
    if (target instanceof Text && target.parentElement?.closest('[data-slot="tooltip-content"]')) return
    lockTooltipsForScroll()
  }
  window.addEventListener('wheel', onScrollIntent, { capture: true, passive: true })
  window.addEventListener('scroll', onScrollIntent, { capture: true, passive: true })
  document.addEventListener('scroll', onScrollIntent, { capture: true, passive: true })
}

/** Test helper — resets module state between cases. */
export function resetTooltipScrollLockForTests(): void {
  locked = false
  if (clearTimer) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
  closeListeners.clear()
  // Do not flip `installed` — listeners stay for the jsdom session.
}
