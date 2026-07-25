// Inline <img> is the only option here — next/image requires JavaScript,
// and guard overlays must render in environments where JS/CSS may be broken.
// Note: <img> appears only inside HTML string constants (GUARD_HEADER_HTML),
// not as JSX, so @next/next/no-img-element does not trigger.

/**
 * Unified guard overlay layout — shared skeleton for all three error states:
 *   - CSS load failure (css-guard.tsx)
 *   - Browser outdated (browser-guard.tsx)
 *   - JavaScript disabled (handled by <noscript> in [locale]/layout.tsx)
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

import { BROWSER_INFO_INLINE_CODE } from '@/lib/browser-info'
import { versionData } from '@/generated/version-data'
import { cn, formatTime } from '@/lib/utils'
import enMessages from '@/messages/en.json'
import jaMessages from '@/messages/ja.json'
import zhCNMessages from '@/messages/zh-CN.json'
import zhTWMessages from '@/messages/zh-TW.json'
import type { WikiLocale } from '@/types/wiki'

// ═══════════════════════════════════════════════════════════════
// Feedback channels — single source of truth for all overlays
// ═══════════════════════════════════════════════════════════════

export interface FeedbackChannel {
  href: string
  labelZh: string
  labelEn: string
}

export const FEEDBACK_CHANNELS = {
  github: { href: 'https://github.com/cmyyx/cep', labelZh: 'GitHub', labelEn: 'GitHub' },
  forum: { href: 'https://end.302200.xyz', labelZh: '\u8BBA\u575B', labelEn: 'Forum' },
  qqGroup: { href: 'https://qm.qq.com/q/Cjdo2aRikE', labelZh: 'QQ\u7FA4 1045523485', labelEn: 'QQ Group 1045523485' },
} as const satisfies Record<string, FeedbackChannel>

const FEEDBACK_CHANNEL_LIST = Object.values(FEEDBACK_CHANNELS)

const FEEDBACK_TITLE_ZH = '\u9047\u5230\u95EE\u9898\uFF1F\u53CD\u9988\u6E20\u9053\uFF1A'
const FEEDBACK_TITLE_EN = 'Having issues? Contact us:'

// ═══════════════════════════════════════════════════════════════
// HTML string constants (compile-time — embedded into IIFE strings)
// ═══════════════════════════════════════════════════════════════

/** Icon + app name — prepended to every guard overlay innerHTML. */
export const GUARD_HEADER_HTML =
  '<img src="/icon.svg" alt="" width="48" height="48" style="display:block">'+
  '<h1 style="font-size:22px;font-weight:600;margin:0;">CEP \u7EC8\u672B\u5730\u89C4\u5212\u5668</h1>'

/** Environment labels sourced from the same locale messages as next-intl. */
export const GUARD_ENVIRONMENT_LABELS = {
  'zh-CN': {
    browser: zhCNMessages.environment.browser,
    engine: zhCNMessages.environment.engine,
    version: zhCNMessages.version.version,
    commits: zhCNMessages.version.commitCount,
    commitTime: zhCNMessages.version.commitTime,
    buildTime: zhCNMessages.version.buildTime,
  },
  'zh-TW': {
    browser: zhTWMessages.environment.browser,
    engine: zhTWMessages.environment.engine,
    version: zhTWMessages.version.version,
    commits: zhTWMessages.version.commitCount,
    commitTime: zhTWMessages.version.commitTime,
    buildTime: zhTWMessages.version.buildTime,
  },
  ja: {
    browser: jaMessages.environment.browser,
    engine: jaMessages.environment.engine,
    version: jaMessages.version.version,
    commits: jaMessages.version.commitCount,
    commitTime: jaMessages.version.commitTime,
    buildTime: jaMessages.version.buildTime,
  },
  en: {
    browser: enMessages.environment.browser,
    engine: enMessages.environment.engine,
    version: enMessages.version.version,
    commits: enMessages.version.commitCount,
    commitTime: enMessages.version.commitTime,
    buildTime: enMessages.version.buildTime,
  },
} satisfies Record<WikiLocale, Record<'browser' | 'engine' | 'version' | 'commits' | 'commitTime' | 'buildTime', string>>

export const GUARD_ENVIRONMENT_VALUES = {
  version: versionData.version,
  count: String(versionData.count),
  commitTime: formatTime(versionData.commitTime),
  buildTime: formatTime(versionData.buildTime),
}

/** Environment details for early guards. Values are escaped before insertion. */
export const GUARD_ENVIRONMENT_HTML_CODE = `(function(){
var i=${BROWSER_INFO_INLINE_CODE},v=${JSON.stringify(GUARD_ENVIRONMENT_VALUES)},L=${JSON.stringify(GUARD_ENVIRONMENT_LABELS)};
var p=(window.location.pathname||'').split('/')[1]||document.documentElement.lang||'en',q='en';
for(var k in L){if(k.toLowerCase()===String(p).toLowerCase()){q=k;break}}
var l=L[q]||L.en;
function h(x){return String(x).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function r(k,x){return'<div style="display:grid;grid-template-columns:max-content minmax(0,1fr);gap:12px;text-align:left;"><dt style="color:#999;">'+h(k)+'</dt><dd style="min-width:0;margin:0;color:#666;overflow-wrap:anywhere;">'+h(x)+'</dd></div>'}
return'<dl style="display:flex;flex-direction:column;gap:4px;max-width:100%;margin:0;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;">'+
r(l.browser,i.browser)+r(l.engine,i.engine)+r(l.version,v.version)+r(l.commits,v.count)+
r(l.commitTime,v.commitTime)+r(l.buildTime,v.buildTime)+'</dl>'
})()`

/** Feedback links as inline HTML — for IIFE guards (CssGuard / BrowserGuard). */
export const GUARD_FEEDBACK_HTML =
  '<p style="font-size:12px;color:#999;margin:0;line-height:1.8;">'+
  FEEDBACK_TITLE_ZH+'<br>'+
  FEEDBACK_CHANNEL_LIST.map(
    (ch) => '<a href="'+ch.href+'" target="_blank" rel="noopener" '+
    'style="color:#0a72ef;margin-left:4px;">'+ch.labelZh+'</a>'
  ).join(' &middot; ')+
  '<br>'+
  FEEDBACK_TITLE_EN+'<br>'+
  FEEDBACK_CHANNEL_LIST.map(
    (ch) => '<a href="'+ch.href+'" target="_blank" rel="noopener" '+
    'style="color:#0a72ef;margin-left:4px;">'+ch.labelEn+'</a>'
  ).join(' &middot; ')+
  '</p>'

/** Outer wrapper + header — used by IIFE guards as `d.innerHTML = GUARD_OVERLAY_OPEN + content + GUARD_OVERLAY_CLOSE`. */
export const GUARD_OVERLAY_OPEN =
  '<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;'+
  'flex-direction:column;align-items:center;justify-content:center;'+
  'background:#fff;color:#171717;font-family:system-ui,-apple-system,sans-serif;'+
  'text-align:center;padding:24px;gap:16px;">'+
  GUARD_HEADER_HTML

/** Closing tag for the outer wrapper. */
export const GUARD_OVERLAY_CLOSE = '</div>'

// ═══════════════════════════════════════════════════════════════
// React components — used by bootstrap / app-init overlays
// ═══════════════════════════════════════════════════════════════

interface GuardFeedbackProps {
  title?: string
  className?: string
  /** When provided, overrides hardcoded labels with i18n-aware labels. */
  links?: { href: string; label: string }[]
}

function FeedbackLine({ lang, links }: { lang: 'zh' | 'en'; links?: { href: string; label: string }[] }) {
  const channels = links ?? FEEDBACK_CHANNEL_LIST
  const labelKey = lang === 'zh' ? 'labelZh' : 'labelEn'
  return (
    <>
      {channels.map((ch, i) => (
        <span key={ch.href}>
          {i > 0 && ' \u00B7 '}
          <a
            href={ch.href}
            target="_blank"
            rel="noopener"
            className="hover:underline"
            style={{ color: '#0a72ef', marginLeft: i > 0 ? undefined : 4 }}
          >
            {'label' in ch ? ch.label : (ch as FeedbackChannel)[labelKey]}
          </a>
        </span>
      ))}
    </>
  )
}

export function GuardFeedback({ title, className, links }: GuardFeedbackProps) {
  const hasLinks = links && links.length > 0

  return (
    <div
      className={cn('text-xs text-muted-foreground m-0', className)}
      style={{ fontSize: 12, color: '#999', margin: 0, lineHeight: 1.8, textAlign: 'center' }}
    >
      {title ? (
        <p className="m-0" style={{ margin: 0 }}>
          {title}<br />
          {hasLinks ? (
            links!.map((ch, i) => (
              <span key={ch.href}>
                {i > 0 && ' \u00B7 '}
                <a href={ch.href} target="_blank" rel="noopener" className="hover:underline"
                  style={{ color: '#0a72ef', marginLeft: i > 0 ? undefined : 4 }}>
                  {ch.label}
                </a>
              </span>
            ))
          ) : (
            <FeedbackLine lang="zh" />
          )}
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
