'use client'

import { AdSlot } from './ad-slot'

/**
 * 移动端顶部广告 banner（320x100）。挂在 [locale] 布局的横幅栈最上方，
 * 仅移动端显示（md:hidden）；非 sticky，不遮挡页面内容。
 */
export function MobileAdBanner() {
  return (
    <div className="flex shrink-0 justify-center bg-background md:hidden">
      <AdSlot variant="mobile" className="my-2" />
    </div>
  )
}

export default MobileAdBanner
