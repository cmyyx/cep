/**
 * JS-disabled fallback rendered as the first child of <body>.
 *
 * Previously used GuardOverlay — a full-screen white overlay (fixed;inset:0;z-99999)
 * that completely covered page content. This caused search engines like Bing
 * (which don't reliably execute JavaScript) to index the overlay message as the
 * page's primary content, ignoring meta descriptions and the SSG-pre-rendered
 * static HTML underneath.
 *
 * Now renders as a lightweight sticky top banner that warns users without
 * blocking the actual page content. Search engines see both the banner
 * (gated by data-nosnippet) and the real content.
 *
 * Inline styles are intentional — CSS <link> may fail to load when JS is
 * disabled, so the banner must be self-contained.
 */
export function NoscriptFallback() {
  return (
    <noscript>
      {/* Hide the AppInitOverlay when JS is disabled — it's a full-screen
          overlay (fixed;inset:0;z-100) that covers all page content and
          only disappears after JS executes markCompleted(). Without this
          rule, crawlers that don't run JS see a blank "INITIALIZING" screen
          instead of the actual SSG-pre-rendered page. */}
      <style>{`[data-testid="app-init-overlay"]{display:none!important}`}</style>
      <div
        data-nosnippet
        style={{
          display: 'block',
          padding: '10px 16px',
          background: '#fff3cd',
          color: '#664d03',
          borderBottom: '1px solid #ffecb5',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        此应用需要 JavaScript 才能运行。请在浏览器设置中启用 JavaScript 后刷新页面。
        {' / '}
        This application requires JavaScript to run. Please enable JavaScript and
        refresh the page.
      </div>
    </noscript>
  )
}
