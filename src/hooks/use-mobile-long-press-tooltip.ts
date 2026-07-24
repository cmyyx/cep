import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MouseEvent, MutableRefObject, PointerEvent, RefObject, SetStateAction } from 'react'
import {
  ensureTooltipScrollLockInstalled,
  isTooltipScrollLocked,
  lockTooltipsForScroll,
  subscribeTooltipScrollClose,
} from '@/lib/tooltip-scroll-lock'
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

function isPointerOverTrigger(trigger: HTMLButtonElement | null): boolean {
  if (!trigger) return false
  try {
    return trigger.matches(':hover') || document.activeElement === trigger
  } catch {
    return document.activeElement === trigger
  }
}

/**
 * Shared hook for mobile long-press tooltip behavior.
 *
 * On mobile: long-press (300ms) opens the tooltip; it stays open until
 * the user scrolls, taps elsewhere, or clicks the trigger again.
 * On desktop: standard hover/focus behavior via Base UI Tooltip.
 *
 * Scroll handling (desktop):
 * - Capture-phase global lock blocks open on any card during/just after scroll
 * - Open tooltips subscribe to force-close when the lock engages
 * - Same-trigger suppress while pointer remains on a scroll-closed card
 */
export function useMobileLongPressTooltip(
  enabled = true,
): UseMobileLongPressTooltipReturn {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const suppressOpenRef = useRef(false)
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    ensureTooltipScrollLockInstalled()
  }, [])

  // Force-close when any scroll/wheel is detected globally (capture phase).
  useEffect(() => {
    return subscribeTooltipScrollClose(() => {
      if (!openRef.current) return
      suppressOpenRef.current = true
      setOpen(false)
    })
  }, [])

  const closeFromScroll = useCallback(() => {
    suppressOpenRef.current = true
    lockTooltipsForScroll()
    setOpen(false)
  }, [])

  const triggerRef = useCloseOnScroll(open, closeFromScroll)

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const isPointerDownRef = useRef(false)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  useEffect(() => clearLongPress, [clearLongPress])

  const mobileEnabled = isMobile && enabled

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (mobileEnabled) {
      if (!nextOpen && isPointerDownRef.current) return
      if (!nextOpen) setOpen(false)
      return
    }

    if (nextOpen) {
      if (isTooltipScrollLocked()) return
      if (suppressOpenRef.current) {
        if (isPointerOverTrigger(triggerRef.current)) return
        suppressOpenRef.current = false
      }
      setOpen(true)
      // Same-tick race: hover retarget may open B before/while scroll lock engages.
      // Microtask re-check collapses any one-frame flash before paint when possible.
      queueMicrotask(() => {
        if (isTooltipScrollLocked()) {
          suppressOpenRef.current = true
          setOpen(false)
        }
      })
      return
    }

    if (!isPointerOverTrigger(triggerRef.current)) {
      suppressOpenRef.current = false
    }
    setOpen(false)
  }, [mobileEnabled, triggerRef])

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (!mobileEnabled || e.pointerType !== 'touch' || !e.isPrimary) return
    isPointerDownRef.current = true
    longPressTriggeredRef.current = false
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      if (triggerRef.current?.hasPointerCapture(e.pointerId)) triggerRef.current.releasePointerCapture(e.pointerId)
      longPressTriggeredRef.current = true
      setOpen(true)
    }, LONG_PRESS_DELAY)
  }, [mobileEnabled, clearLongPress, triggerRef])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!pointerStartRef.current) return
    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      clearLongPress()
      pointerStartRef.current = null
      isPointerDownRef.current = false
      setOpen(false)
    }
  }, [clearLongPress])

  const handlePointerEnd = useCallback(() => {
    isPointerDownRef.current = false
    clearLongPress()
    pointerStartRef.current = null
  }, [clearLongPress])

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
  }, [])

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
