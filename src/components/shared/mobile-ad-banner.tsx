'use client'

import { AdSlot } from './ad-slot'

/**
 * 移动端顶部广告 banner（320x100）。挂在 [locale] 布局的内容滚动壳顶部，
 * 与页面内容同一滚动上下文，随内容一起滚出视口；仅移动端显示（md:hidden）。
 * 不做成整宽背景条，避免观感上像独立顶栏。
 */
export function MobileAdBanner() {
  return (
    <div className="flex shrink-0 justify-center px-4 pt-3 pb-1 md:hidden">
      <AdSlot variant="mobile" />
    </div>
  )
}

export default MobileAdBanner
