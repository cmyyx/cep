'use client'

import Image from 'next/image'

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
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-develop-blue via-preview-pink to-ship-red rounded-full animate-[bootstrap-progress_1.5s_ease-out_forwards]" />
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
      </div>

      {/* Noscript fallback for users with JavaScript disabled */}
      <noscript>
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
          <div className="absolute inset-0 pointer-events-none bg-engineering-grid" />
          <div className="relative flex flex-col items-center gap-6 z-10 max-w-md text-center px-6">
            <Image
              src="/icon.svg"
              alt=""
              width={48}
              height={48}
              className="size-12"
              unoptimized
            />
            <h1 className="text-2xl font-semibold tracking-tight">
              CEP 终末地规划器
            </h1>
            <div className="space-y-3 text-muted-foreground">
              <p>
                此应用需要 JavaScript 才能运行。<br />
                请在浏览器设置中启用 JavaScript 后刷新页面。
              </p>
              <p className="text-sm">
                This application requires JavaScript to run.<br />
                Please enable JavaScript in your browser settings and refresh the page.
              </p>
            </div>
          </div>
        </div>
      </noscript>
    </div>
  )
}
