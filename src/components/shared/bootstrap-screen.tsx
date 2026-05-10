'use client'

import Image from 'next/image'

/**
 * Minimal branded splash screen displayed during the initial locale
 * redirect (RootRedirect). No progress tracking — the full
 * AppInitOverlay in LocaleLayout takes over once the redirect lands.
 *
 * Designed to match AppInitOverlay's visual language so the handoff
 * feels seamless.
 */
export function BootstrapScreen() {
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
      </div>
    </div>
  )
}
