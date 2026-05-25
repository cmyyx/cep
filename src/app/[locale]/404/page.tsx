'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

/**
 * Locale-aware 404 page (regular route, NOT the special not-found file).
 *
 * Accessible at /<locale>/404. Rendered via redirect from the root
 * catch-all 404 handler (public/404.html in production, app/not-found.tsx
 * in dev mode).
 *
 * Sits inside [locale]/layout.tsx → full access to NextIntlClientProvider
 * → translations from i18n JSON files, zero hardcoded strings.
 */
export default function NotFoundPage() {
  const locale = useLocale()
  const t = useTranslations()

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      {/* Engineering grid background */}
      <div className="absolute inset-0 pointer-events-none animate-[grid-drift_20s_linear_infinite] bg-engineering-grid" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-7 z-10">
        {/* Icon with breathing pulse */}
        <div className="animate-[icon-pulse_2s_ease-in-out_infinite] size-14 flex items-center justify-center">
          <div className="relative size-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt=""
              className="size-14"
            />
            <div className="absolute inset-0 -z-10 rounded-full bg-develop-blue/10 blur-xl scale-125 animate-[icon-glow_2s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* 404 code */}
        <h1 className="text-[48px] font-semibold font-mono tracking-[-2.88px] text-foreground select-none">
          404
        </h1>

        {/* Translated message */}
        <p className="text-sm text-muted-foreground tracking-[-0.32px] font-medium -mt-5 text-center">
          {t('notFound.title')}
        </p>

        {/* Home link */}
        <Link
          href={`/${locale}`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 text-center"
        >
          {t('notFound.homeLink')}
        </Link>
      </div>
    </div>
  )
}
