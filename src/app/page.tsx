import Link from 'next/link'
import { HeadScript } from '@/components/shared/head-script'
import { FullScreenStatus } from '@/components/shared/full-screen-status'
import { GuardFeedback } from '@/components/shared/guard-layout'
import { ROOT_REDIRECT_SCRIPT } from '@/lib/root-redirect'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/locale-utils'

/** Native language names for the no-JS language picker. */
const LOCALE_LABELS: Record<(typeof SUPPORTED_LOCALES)[number], string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  en: 'English',
}

/**
 * Root route handler.
 *
 * Server component on purpose — this page must not hydrate React. It used to be
 * a `'use client'` component whose only job was `router.replace('/<locale>')`,
 * which cost 18 chunks / 383 KB gzip before the redirect could even start, plus
 * a 2 s fallback timer that escalated a slow RSC navigation into a full reload.
 *
 * The redirect is a synchronous inline script (see `@/lib/root-redirect`), and
 * `scripts/optimize-root-entry.mjs` strips Next's chunk scripts and RSC payload
 * from the exported `out/index.html` so the entry ships no framework JS at all.
 *
 * `FullScreenStatus` and `GuardFeedback` are plain server-renderable components
 * (no `'use client'`), so the splash markup still renders in the static HTML —
 * both for the brief pre-redirect frame and for the no-JS fallback below.
 *
 * Note: BootstrapScreen is deliberately NOT used here — it is a client
 * component, and importing it would re-introduce the React bundle.
 */
export default function RootRedirectPage() {
  return (
    <>
      {/* Relocated into <head> ahead of the stylesheets by postbuild. A
          synchronous inline script is blocked by any preceding stylesheet, so
          leaving it here would delay the redirect by the CSS round-trip. */}
      <HeadScript id="root-redirect" code={ROOT_REDIRECT_SCRIPT} />

      <FullScreenStatus
        heading="终末地规划器"
        animateIcon
        indicator={(
          <div className="w-[280px]">
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 animate-[bootstrap-progress_10s_ease-out_forwards] rounded-full bg-gradient-to-r from-develop-blue via-preview-pink to-ship-red" />
            </div>
            <p className="mt-3 select-none text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">REDIRECTING TO YOUR LANGUAGE</p>
          </div>
        )}
        footer={<GuardFeedback />}
      />

      {/* No JS: the inline script never runs, so fall back to a meta refresh
          plus manual language links. Same structure the previous
          BootstrapScreen noscript branch rendered. */}
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=/${DEFAULT_LOCALE}`} />
        <FullScreenStatus
          heading="终末地规划器"
          actions={(
            <div className="flex flex-col items-center gap-3 opacity-0 animate-noscript-delay-reveal">
              <p className="text-xs text-muted-foreground">选择语言 / Choose language / 言語を選択 / 選擇語言</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUPPORTED_LOCALES.map((locale) => (
                  <Link
                    key={locale}
                    href={`/${locale}`}
                    className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80"
                  >
                    {LOCALE_LABELS[locale]}
                  </Link>
                ))}
              </div>
            </div>
          )}
        />
      </noscript>
    </>
  )
}
