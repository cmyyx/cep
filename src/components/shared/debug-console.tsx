'use client'

/**
 * Lightweight trigger for the debug console.
 *
 * Renders nothing visible. Exports `openDebugConsole()` which opens
 * the pure-DOM debug panel (from /debug-panel.js), loading it on
 * demand if it hasn't been executed yet.
 *
 * The panel UI is defined in public/debug-panel.js — a single source
 * of truth that works with or without React.
 */

let panelLoadPromise: Promise<void> | null = null

/** Ensure debug-panel.js is loaded and executed. Idempotent. */
function ensurePanelLoaded(): Promise<void> {
  // Already loaded (by layout.tsx afterInteractive Script or previous call)
  // @ts-expect-error __cep_debug__ is set by the bootstrap inline script
  if (window.__cep_debug__?._openPanel) return Promise.resolve()

  if (!panelLoadPromise) {
    panelLoadPromise = new Promise<void>((resolve) => {
      const script = document.createElement('script')
      script.src = '/debug-panel.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        panelLoadPromise = null
        resolve() // resolve anyway — bootstrap's openPanel() fallback will try its own load
      }
      document.head.appendChild(script)
    })
  }
  return panelLoadPromise
}

/**
 * Open the debug console panel.
 *
 * If debug-panel.js hasn't been loaded yet, loads it first, then opens.
 * Safe to call at any time — even before React hydrates.
 */
export async function openDebugConsole(): Promise<void> {
  await ensurePanelLoaded()
  // @ts-expect-error __cep_debug__._openPanel is defined by debug-panel.js
  window.__cep_debug__?._openPanel?.()
}
