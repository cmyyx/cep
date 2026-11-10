'use client'

import { AdSlot } from './ad-slot'
import { ADS_ENABLED } from '@/lib/ad-slot-spec'

/**
 * 移动端顶部广告 banner。挂在 [locale] 布局的内容滚动壳顶部，与页面内容同一滚动
 * 上下文，随内容一起滚出视口；仅移动端显示（md:hidden）。
 * 不做成整宽背景条，避免观感上像独立顶栏。
 *
 * 当前不投放广告（ADS_ENABLED 默认 false）：整块不渲染，不留空条、不发起请求。
 * 盒位尺寸见 src/lib/ad-slot-spec.ts。
 *
 * 上下留白挂在 AdSlot 的 className 上（而非外层容器）：没有素材时槽位返回
 * 隐藏节点，留白随之消失，不会在页面顶部留一条空条把首屏内容下推。
 */
export function MobileAdBanner() {
  if (!ADS_ENABLED) return null
  return (
    <div className="flex shrink-0 justify-center px-0 sm:px-4 md:hidden">
      <AdSlot variant="mobile" className="mt-3 mb-1" />
    </div>
  )
}

export default MobileAdBanner
