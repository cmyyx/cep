import { useEffect, useRef } from 'react'

/**
 * Dismiss a controlled tooltip when any scrollable ancestor scrolls.
 * This prevents the tooltip from being left behind when the user scrolls
 * the container without moving the mouse — which would otherwise cause
 * the portal-rendered popup to drift outside the viewport and trigger
 * unwanted horizontal scrollbars.
 */
export function useCloseOnScroll(
  open: boolean,
  setOpen: (open: boolean) => void,
) {
  const ref = useRef<HTMLButtonElement>(null)

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

    const handler = () => setOpen(false)
    scrollables.forEach((el) => {
      el.addEventListener('scroll', handler, { passive: true })
      el.addEventListener('wheel', handler, { passive: true })
    })
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('wheel', handler, { passive: true })
    document.scrollingElement?.addEventListener('scroll', handler, { passive: true })
    document.scrollingElement?.addEventListener('wheel', handler, { passive: true })
    return () => {
      scrollables.forEach((el) => {
        el.removeEventListener('scroll', handler)
        el.removeEventListener('wheel', handler)
      })
      window.removeEventListener('scroll', handler)
      window.removeEventListener('wheel', handler)
      document.scrollingElement?.removeEventListener('scroll', handler)
      document.scrollingElement?.removeEventListener('wheel', handler)
    }
  }, [open, setOpen])

  return ref
}
