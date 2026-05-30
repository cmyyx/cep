import { GuardOverlay } from '@/components/shared/guard-layout'

/**
 * JS-disabled fallback rendered as the first child of <body>.
 *
 * Delegates the shared layout (icon + brand name + wrapper) to GuardOverlay
 * and only provides the noscript-specific content.
 */
export function NoscriptFallback() {
  return (
    <noscript>
      <GuardOverlay>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 500,
            margin: 0,
            color: '#171717',
          }}
        >
          需要 JavaScript
        </h2>
        <div
          style={{
            color: '#666',
            maxWidth: 400,
            lineHeight: 1.6,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ margin: 0 }}>
            此应用需要 JavaScript 才能运行。
            <br />
            请在浏览器设置中启用 JavaScript 后刷新页面。
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            This application requires JavaScript to run.
            <br />
            Please enable JavaScript in your browser settings and refresh the
            page.
          </p>
        </div>
      </GuardOverlay>
    </noscript>
  )
}
