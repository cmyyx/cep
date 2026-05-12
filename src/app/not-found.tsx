import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 - CEP',
}

/**
 * Full-viewport 404 page styled to match the app's loading overlay.
 * Hardcoded 4-language text — no next-intl dependency.
 *
 * The home link points to `/` (root), which auto-detects the user's locale
 * via navigator.language and redirects to /[locale].
 */
export default function NotFound() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      {/* Engineering grid background — matches AppInitOverlay */}
      <div className="absolute inset-0 pointer-events-none animate-[grid-drift_20s_linear_infinite] bg-engineering-grid" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-7 z-10">
        {/* Icon with breathing pulse — identical to loading screen */}
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

        {/* 404 code — same typography as loading screen's CEP title */}
        <h1 className="text-[48px] font-semibold font-mono tracking-[-2.88px] text-foreground select-none">
          404
        </h1>

        {/* Error messages in all 4 languages */}
        <div className="space-y-1.5 text-center -mt-5">
          <p className="text-sm text-muted-foreground tracking-[-0.32px] font-medium">
            页面未找到
          </p>
          <p className="text-xs text-muted-foreground/60">
            Page not found
          </p>
          <p className="text-xs text-muted-foreground/60">
            ページが見つかりません
          </p>
          <p className="text-xs text-muted-foreground/60">
            頁面未找到
          </p>
        </div>

        {/* Home link — all 4 languages */}
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 text-center"
        >
          返回首页 · Return Home · ホームに戻る · 返回首頁
        </Link>
      </div>
    </div>
  )
}
