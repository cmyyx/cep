import { useEffect, useEffectEvent, useRef } from 'react'

/**
 * Dismiss a controlled tooltip when any scrollable ancestor scrolls.
 * This prevents the tooltip from being left behind when the user scrolls
 * the container without moving the mouse — which would otherwise cause
 * the portal-rendered popup to drift outside the viewport and trigger
 * unwanted horizontal scrollbars.
 *
 * Callers should treat scroll-close as "suppress reopen until pointer leaves"
 * so Base UI hover does not instantly flash the tooltip back open.
 */
export function useCloseOnScroll(
  open: boolean,
  onScrollClose: () => void,
) {
  const ref = useRef<HTMLButtonElement>(null)
  const onScrollCloseEvent = useEffectEvent(onScrollClose)

  useEffect(() => {
    if (!open || !ref.current) return

    const scrollables: HTMLElement[] = []
    let el: HTMLElement | null = ref.current.parentElement
    while (el) {
      const style = window.getComputedStyle(el)
      if (/(auto|scroll)/.test(style.overflow + style.overflowY)) {
        scrollables.push(el)
      }
      el = el.parentElement
    }

    const handler = (event: Event) => {
      const target = event.target
      // Allow scrolling inside the tooltip popup itself (long previews).
      if (target instanceof Element && target.closest('[data-slot="tooltip-content"]')) return
      onScrollCloseEvent()
    }
    scrollables.forEach((node) => {
      node.addEventListener('scroll', handler, { passive: true })
      node.addEventListener('wheel', handler, { passive: true })
    })
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('wheel', handler, { passive: true })
    document.scrollingElement?.addEventListener('scroll', handler, { passive: true })
    document.scrollingElement?.addEventListener('wheel', handler, { passive: true })
    return () => {
      scrollables.forEach((node) => {
        node.removeEventListener('scroll', handler)
        node.removeEventListener('wheel', handler)
      })
      window.removeEventListener('scroll', handler)
      window.removeEventListener('wheel', handler)
      document.scrollingElement?.removeEventListener('scroll', handler)
      document.scrollingElement?.removeEventListener('wheel', handler)
    }
  }, [open])

  return ref
}
