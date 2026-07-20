'use client'

import Link from 'next/link'
import { GuardFeedback } from '@/components/shared/guard-layout'
import { FullScreenStatus } from '@/components/shared/full-screen-status'

interface BootstrapScreenProps {
  timedOut?: boolean
  status?: string
}

/**
 * Minimal branded splash screen displayed during the initial locale
 * redirect (RootRedirect). Includes a status indicator for redirect
 * progress and a noscript fallback for users with JavaScript disabled.
 *
 * Designed to match AppInitOverlay's visual language so the handoff
 * feels seamless.
 */
export function BootstrapScreen({ timedOut = false, status }: BootstrapScreenProps) {
  return (
    <>
      <FullScreenStatus
        heading="终末地规划器"
        animateIcon
        indicator={(
          <div className="w-[280px]">
            {timedOut ? (
              <div className="text-center">
                <p className="select-none font-mono text-[11px] uppercase tracking-[0.2em] text-destructive">REDIRECT TIMEOUT</p>
                <p className="mt-2 select-none text-xs text-muted-foreground">请检查网络连接或刷新页面 / Please check your network or try refreshing</p>
              </div>
            ) : (
              <>
                <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 animate-[bootstrap-progress_10s_ease-out_forwards] rounded-full bg-gradient-to-r from-develop-blue via-preview-pink to-ship-red" />
                </div>
                <p className="mt-3 select-none text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">REDIRECTING TO YOUR LANGUAGE</p>
              </>
            )}
          </div>
        )}
        description={status ? <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/30">{status}</span> : undefined}
        footer={<GuardFeedback />}
      />

      <noscript>
        <meta httpEquiv="refresh" content="0;url=/zh-CN" />
        <FullScreenStatus
          heading="终末地规划器"
          actions={(
            <div className="flex flex-col items-center gap-3 opacity-0 animate-noscript-delay-reveal">
              <p className="text-xs text-muted-foreground">选择语言 / Choose language / 言語を選択 / 選擇語言</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/zh-CN" className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">简体中文</Link>
                <Link href="/zh-TW" className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">繁體中文</Link>
                <Link href="/ja" className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">日本語</Link>
                <Link href="/en" className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">English</Link>
              </div>
            </div>
          )}
        />
      </noscript>
    </>
  )
}
