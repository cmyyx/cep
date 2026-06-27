import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MouseEvent, MutableRefObject, PointerEvent, RefObject, SetStateAction } from 'react'
import { useIsMobile } from './use-mobile'
import { useCloseOnScroll } from './use-close-on-scroll'

const LONG_PRESS_DELAY = 300
const MOVE_THRESHOLD = 10

interface UseMobileLongPressTooltipReturn {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  triggerRef: RefObject<HTMLButtonElement | null>
  longPressTriggered: MutableRefObject<boolean>
  handleOpenChange: (nextOpen: boolean) => void
  handlePointerDown: (e: PointerEvent) => void
  handlePointerMove: (e: PointerEvent) => void
  handlePointerEnd: () => void
  handleContextMenu: (e: MouseEvent) => void
  swallowLongPressClick: () => boolean
  isMobile: boolean
}

/**
 * Shared hook for mobile long-press tooltip behavior.
 *
 * On mobile: long-press (300ms) opens the tooltip; it stays open until
 * the user scrolls, taps elsewhere, or clicks the trigger again.
 * On desktop: standard hover/focus behavior via Base UI Tooltip.
 *
 * @param enabled - Whether the long-press tooltip is active (default: true).
 *                  When false on mobile, no pointer handlers are bound and
 *                  Base UI's default hover/focus behavior is restored.
 */
export function useMobileLongPressTooltip(
  enabled = true,
): UseMobileLongPressTooltipReturn {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const triggerRef = useCloseOnScroll(open, setOpen)

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  // True from pointerdown until pointerup/cancel — blocks Base UI close while finger is down
  const isPointerDownRef = useRef(false)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // Clear long-press timer on unmount to prevent state updates on unmounted component
  useEffect(() => clearLongPress, [clearLongPress])

  const mobileEnabled = isMobile && enabled

  // On mobile, prevent Base UI from auto-opening the tooltip (focus/hover),
  // and block close requests while the user's finger is still down.
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (mobileEnabled) {
      if (!nextOpen && isPointerDownRef.current) return
      if (!nextOpen) setOpen(false)
      return
    }
    setOpen(nextOpen)
  }, [mobileEnabled])

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (!mobileEnabled) return
    isPointerDownRef.current = true
    longPressTriggeredRef.current = false
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setOpen(true)
    }, LONG_PRESS_DELAY)
  }, [mobileEnabled, clearLongPress])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!pointerStartRef.current) return
    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      clearLongPress()
      pointerStartRef.current = null
    }
  }, [clearLongPress])

  const handlePointerEnd = useCallback(() => {
    isPointerDownRef.current = false
    clearLongPress()
    pointerStartRef.current = null
    // If long press was triggered, keep tooltip open and keep longPressTriggeredRef
    // set so the subsequent click event can be swallowed by swallowLongPressClick
    if (longPressTriggeredRef.current) return
  }, [clearLongPress])

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
  }, [])

  /**
   * Call at the start of a click/toggle handler.
   * Returns true if the click was a long-press release and should be swallowed.
   * Also clears the longPressTriggered flag.
   */
  const swallowLongPressClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return true
    }
    return false
  }, [])

  return {
    open,
    setOpen,
    triggerRef,
    longPressTriggered: longPressTriggeredRef,
    handleOpenChange,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleContextMenu,
    swallowLongPressClick,
    isMobile,
  }
}
