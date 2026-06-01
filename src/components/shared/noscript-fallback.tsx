import type { ReactNode } from 'react'
import { GuardOverlay, GuardFeedback } from '@/components/shared/guard-layout'

interface NoscriptFallbackProps {
  subtitle?: ReactNode
  descriptionZh?: ReactNode
  descriptionEn?: ReactNode
}

/**
 * JS-disabled fallback rendered as the first child of <body>.
 *
 * Wrapper uses inline styles (HeadScript exception — must render without
 * CSS). Children use Tailwind className strings, which do apply in SSR
 * output since the CSS <link> loads regardless of JS.
 *
 * All user-facing content accepts translated props; defaults are bilingual
 * so the fallback functions without i18n infrastructure.
 */
export function NoscriptFallback({
  subtitle = '需要 JavaScript',
  descriptionZh = (
    <>
      此应用需要 JavaScript 才能运行。
      <br />
      请在浏览器设置中启用 JavaScript 后刷新页面。
    </>
  ),
  descriptionEn = (
    <>
      This application requires JavaScript to run.
      <br />
      Please enable JavaScript in your browser settings and refresh the page.
    </>
  ),
}: NoscriptFallbackProps) {
  return (
    <noscript>
      <GuardOverlay>
        <h2 className="text-base font-medium m-0 text-foreground">
          {subtitle}
        </h2>
        <div className="text-[#666] max-w-[400px] leading-relaxed flex flex-col gap-3">
          <p className="m-0">{descriptionZh}</p>
          <p className="m-0 text-[13px] text-[#999]">{descriptionEn}</p>
        </div>
        <GuardFeedback />
      </GuardOverlay>
    </noscript>
  )
}
