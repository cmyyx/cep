'use client'

import { AdSlot } from './ad-slot'

/**
 * 移动端顶部广告 banner（320x100）。挂在 [locale] 布局的内容滚动壳顶部，
 * 与页面内容同一滚动上下文，随内容一起滚出视口；仅移动端显示（md:hidden）。
 * 不做成整宽背景条，避免观感上像独立顶栏。
 *
 * 上下留白挂在 AdSlot 的 className 上（而非外层容器）：AdSlot 无生效广告时
 * 返回 null，留白随之消失，不会在页面顶部留一条 16px 的空条把首屏内容下推。
 */
export function MobileAdBanner() {
  return (
    <div className="flex shrink-0 justify-center px-0 sm:px-4 md:hidden">
      <AdSlot variant="mobile" className="mt-3 mb-1" />
    </div>
  )
}

export default MobileAdBanner
