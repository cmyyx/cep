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
 *   [feedback links — GitHub / Forum / QQ Group]
 *
 * Uses inline styles because in error states external CSS cannot be assumed.
 * Legitimate exception to the "no inline style" rule (same class as HeadScript).
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// Feedback channels — single source of truth for all overlays
// ═══════════════════════════════════════════════════════════════

interface FeedbackChannel {
  href: string
  labelZh: string
  labelEn: string
}

const FEEDBACK_CHANNELS: FeedbackChannel[] = [
  { href: 'https://github.com/cmyyx/cep', labelZh: 'GitHub', labelEn: 'GitHub' },
  { href: 'https://end.302200.xyz', labelZh: '\u8BBA\u575B', labelEn: 'Forum' },
  { href: 'https://qm.qq.com/q/Cjdo2aRikE', labelZh: 'QQ\u7FA4 1045523485', labelEn: 'QQ Group 1045523485' },
]

const FEEDBACK_TITLE_ZH = '\u9047\u5230\u95EE\u9898\uFF1F\u53CD\u9988\u6E20\u9053\uFF1A'
const FEEDBACK_TITLE_EN = 'Having issues? Contact us:'

// ═══════════════════════════════════════════════════════════════
// HTML string constants (compile-time — embedded into IIFE strings)
// ═══════════════════════════════════════════════════════════════

/** Icon + app name — prepended to every guard overlay innerHTML. */
export const GUARD_HEADER_HTML =
  '<img src="/icon.svg" alt="" width="48" height="48" style="display:block">'+
  '<h1 style="font-size:22px;font-weight:600;margin:0;">CEP \u7EC8\u672B\u5730\u89C4\u5212\u5668</h1>'

/** Feedback links as inline HTML — for IIFE guards (CssGuard / BrowserGuard). */
export const GUARD_FEEDBACK_HTML =
  '<p style="font-size:12px;color:#999;margin:0;line-height:1.8;">'+
  FEEDBACK_TITLE_ZH+'<br>'+
  FEEDBACK_CHANNELS.map(
    (ch) => '<a href="'+ch.href+'" target="_blank" rel="noopener" '+
    'style="color:#0a72ef;margin-left:4px;">'+ch.labelZh+'</a>'
  ).join(' &middot; ')+
  '<br>'+
  FEEDBACK_TITLE_EN+'<br>'+
  FEEDBACK_CHANNELS.map(
    (ch) => '<a href="'+ch.href+'" target="_blank" rel="noopener" '+
    'style="color:#0a72ef;margin-left:4px;">'+ch.labelEn+'</a>'
  ).join(' &middot; ')+
  '</p>'

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
// React components — used by noscript / bootstrap / app-init overlays
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

interface GuardFeedbackProps {
  title?: string
  className?: string
}

function FeedbackLine({ lang }: { lang: 'zh' | 'en' }) {
  const labelKey = lang === 'zh' ? 'labelZh' : 'labelEn'
  return (
    <>
      {FEEDBACK_CHANNELS.map((ch, i) => (
        <span key={ch.href}>
          {i > 0 && ' \u00B7 '}
          <a
            href={ch.href}
            target="_blank"
            rel="noopener"
            className="hover:underline"
            style={{ color: '#0a72ef', marginLeft: i > 0 ? undefined : 4 }}
          >
            {ch[labelKey]}
          </a>
        </span>
      ))}
    </>
  )
}

export function GuardFeedback({ title, className }: GuardFeedbackProps) {
  return (
    <div
      className={cn('text-xs text-muted-foreground m-0', className)}
      style={{ fontSize: 12, color: '#999', margin: 0, lineHeight: 1.8, textAlign: 'center' }}
    >
      {title ? (
        <p className="m-0" style={{ margin: 0 }}>
          {title}<br /><FeedbackLine lang="zh" />
        </p>
      ) : (
        <>
          <p className="m-0" style={{ margin: 0 }}>
            {FEEDBACK_TITLE_ZH}<br /><FeedbackLine lang="zh" />
          </p>
          <p className="m-0" style={{ margin: 0 }}>
            {FEEDBACK_TITLE_EN}<br /><FeedbackLine lang="en" />
          </p>
        </>
      )}
    </div>
  )
}
