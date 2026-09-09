'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export interface SidebarScrollState {
  /** 内容上方还有未展示内容（应显示顶部渐隐提示）。 */
  canScrollUp: boolean
  /** 内容下方还有未展示内容（应显示底部渐隐提示）。 */
  canScrollDown: boolean
  /** 绑定到滚动容器的 ref。 */
  contentRef: RefObject<HTMLDivElement | null>
  /** 绑定到滚动容器 onScroll。 */
  handleScroll: () => void
}

/**
 * 侧边栏导航区的滚动状态。滚动条被 no-scrollbar 隐藏，溢出只能靠
 * 上下渐隐提示表达；该 hook 跟踪两个方向是否仍有剩余内容。
 *
 * 除了 scroll 事件外还挂 ResizeObserver：广告高度自适应、页脚增删项
 * 都会改变滚动容器的可视高度，这些变化不产生 scroll 事件。
 */
export function useSidebarScrollState(): SidebarScrollState {
  const contentRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const sync = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    setCanScrollUp(el.scrollTop > 0)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sync])

  return { canScrollUp, canScrollDown, contentRef, handleScroll: sync }
}

export default useSidebarScrollState
