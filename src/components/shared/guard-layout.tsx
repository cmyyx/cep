/* eslint-disable @next/next/no-img-element */
// Inline <img> is the only option here — next/image requires JavaScript,
// and guard overlays must render in environments where JS/CSS may be broken.

/**
 * Unified guard overlay layout — shared skeleton for all three error states:
 *   - CSS load failure (css-guard.tsx)
 *   - Browser outdated (browser-guard.tsx)
 *   - JavaScript disabled (noscript-fallback.tsx)
 *
 * Every overlay follows the same visual skeleton:
 *
 *   [icon.svg 48x48]
 *   CEP 终末地规划器
 *   [caller-provided content — subtitle, description, action]
 *
 * Uses inline styles because in error states external CSS cannot be assumed.
 * Legitimate exception to the "no inline style" rule (same class as HeadScript).
 */

import type { ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════
// HTML string constants (compile-time — embedded into IIFE strings)
// ═══════════════════════════════════════════════════════════════

/** Icon + app name — prepended to every guard overlay innerHTML. */
export const GUARD_HEADER_HTML =
  '<img src="/icon.svg" alt="" width="48" height="48" style="display:block">'+
  '<h1 style="font-size:22px;font-weight:600;margin:0;">CEP \u7EC8\u672B\u5730\u89C4\u5212\u5668</h1>'

/** Outer wrapper + header — used by IIFE guards as `d.innerHTML = GUARD_OVERLAY_OPEN + content + GUARD_OVERLAY_CLOSE`. */
export const GUARD_OVERLAY_OPEN =
  '<div style="position:fixed;inset:0;z-index:99999;display:flex;'+
  'flex-direction:column;align-items:center;justify-content:center;'+
  'background:#fff;color:#171717;font-family:system-ui,-apple-system,sans-serif;'+
  'text-align:center;padding:24px;gap:16px;">'+
  GUARD_HEADER_HTML

/** Closing tag for the outer wrapper. */
export const GUARD_OVERLAY_CLOSE = '</div>'

// ═══════════════════════════════════════════════════════════════
// React component — used by noscript-fallback.tsx
// ═══════════════════════════════════════════════════════════════

export function GuardOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        color: '#171717',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        padding: 24,
        gap: 16,
      }}
    >
      <img
        src="/icon.svg"
        alt=""
        width={48}
        height={48}
        style={{ display: 'block' }}
      />
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
        CEP 终末地规划器
      </h1>
      {children}
    </div>
  )
}
