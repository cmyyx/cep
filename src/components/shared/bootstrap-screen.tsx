'use client'

import Image from 'next/image'
import Link from 'next/link'
import { GuardFeedback } from '@/components/shared/guard-layout'

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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      {/* Engineering grid background */}
      <div className="absolute inset-0 pointer-events-none bg-engineering-grid" />

      <div className="relative flex flex-col items-center gap-7 z-10">
        {/* Icon */}
        <div className="animate-[icon-pulse_2s_ease-in-out_infinite] size-14 flex items-center justify-center">
          <div className="relative size-14">
            <Image
              src="/icon.svg"
              alt=""
              width={56}
              height={56}
              className="size-14"
              unoptimized
              priority
            />
            <div className="absolute inset-0 -z-10 rounded-full bg-develop-blue/10 blur-xl scale-125 animate-[icon-glow_2s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Brand */}
        <h1
          className="text-[48px] font-semibold font-mono tracking-[-2.88px] text-foreground select-none animate-[glitch-converge_1.2s_cubic-bezier(0.16,1,0.3,1)_forwards]"
        >
          CEP
        </h1>

        <p className="text-sm text-muted-foreground tracking-[-0.32px] font-medium -mt-5 select-none">
          终末地规划器
        </p>

        {/* Progress bar or timeout error */}
        <div className="w-[280px]">
          {timedOut ? (
            <div className="text-center">
              <p className="font-mono text-[11px] tracking-[0.2em] text-destructive uppercase select-none">
                REDIRECT TIMEOUT
              </p>
              <p className="mt-2 text-xs text-muted-foreground select-none">
                请检查网络连接或刷新页面 / Please check your network or try refreshing
              </p>
            </div>
          ) : (
            <>
              <div className="relative h-[3px] w-full bg-muted rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-develop-blue via-preview-pink to-ship-red rounded-full animate-[bootstrap-progress_10s_ease-out_forwards]" />
              </div>
              <p className="mt-3 text-center font-mono text-[11px] tracking-[0.2em] text-muted-foreground/60 uppercase select-none">
                REDIRECTING TO YOUR LANGUAGE
              </p>
            </>
          )}
        </div>

        {/* Status indicator */}
        {status && (
          <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground/30 uppercase select-none">
            {status}
          </p>
        )}

        {/* Feedback channels */}
        <GuardFeedback />
      </div>

      {/* Noscript fallback: mirrors the BootstrapScreen brand layout.
          <meta http-equiv="refresh"> auto-redirects to zh-CN in 0s.
          Language buttons appear after a 3s delay — only visible if the
          browser ignores the meta refresh or the redirect stalls. */}
      <noscript>
        <meta httpEquiv="refresh" content="0;url=/zh-CN" />
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
          <div className="absolute inset-0 pointer-events-none bg-engineering-grid" />
          <div className="relative flex flex-col items-center gap-7 z-10">
            <div className="size-14 flex items-center justify-center">
              <Image
                src="/icon.svg"
                alt=""
                width={56}
                height={56}
                className="size-14"
                unoptimized
              />
            </div>
            <h1 className="text-[48px] font-semibold font-mono tracking-[-2.88px] text-foreground select-none">
              CEP
            </h1>
            <p className="text-sm text-muted-foreground tracking-[-0.32px] font-medium -mt-5 select-none">
              终末地规划器
            </p>
            {/* Language selector — delayed 3s via CSS animation.
                If the meta refresh succeeds, this never becomes visible. */}
            <div className="flex flex-col items-center gap-3 opacity-0 animate-noscript-delay-reveal">
              <p className="text-xs text-muted-foreground">
                选择语言 / Choose language / 言語を選択 / 選擇語言
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/zh-CN" className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">简体中文</Link>
                <Link href="/zh-TW" className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">繁體中文</Link>
                <Link href="/ja"    className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">日本語</Link>
                <Link href="/en"    className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80">English</Link>
              </div>
            </div>
          </div>
        </div>
      </noscript>
    </div>
  )
}
