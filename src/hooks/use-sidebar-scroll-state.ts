'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export interface SidebarScrollState {
  /** 内容上方还有未展示内容（应显示顶部渐隐提示）。 */
  canScrollUp: boolean
  /** 内容下方还有未展示内容（应显示底部渐隐提示）。 */
  canScrollDown: boolean
  /** 绑定到滚动容器的 ref。 */
  contentRef: RefObject<HTMLDivElement | null>
  /** 绑定到滚动内容层的 ref（scrollHeight 随子项变化）。 */
  contentInnerRef: RefObject<HTMLDivElement | null>
  /** 绑定到滚动容器 onScroll。 */
  handleScroll: () => void
}

/**
 * 侧边栏导航区的滚动状态。滚动条被 no-scrollbar 隐藏，溢出只能靠
 * 上下渐隐提示表达；该 hook 跟踪两个方向是否仍有剩余内容。
 *
 * 同时 observe 容器与内容层：广告/页脚改变的是容器可视高度；子项增减、
 * 收起展开切换结构只改 scrollHeight，容器尺寸不变时 ResizeObserver 不会
 * 对容器触发，必须听内容层。
 */
export function useSidebarScrollState(): SidebarScrollState {
  const contentRef = useRef<HTMLDivElement>(null)
  const contentInnerRef = useRef<HTMLDivElement>(null)
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
    const inner = contentInnerRef.current
    if (!el) return
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    if (inner) observer.observe(inner)
    return () => observer.disconnect()
  }, [sync])

  return {
    canScrollUp,
    canScrollDown,
    contentRef,
    contentInnerRef,
    handleScroll: sync,
  }
}

export default useSidebarScrollState
