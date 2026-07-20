'use client'

import { useEffect } from 'react'

const BLOCKED_SCREEN_SELECTOR = '[data-blocked-screen="true"]'
const ALLOWED_INTERACTION_SELECTOR = '[data-blocked-allow="true"]'
const BLOCKED_EVENTS = ['click', 'auxclick', 'pointerdown', 'touchstart', 'submit'] as const

function isAllowedTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(ALLOWED_INTERACTION_SELECTOR) !== null
}

export function useBlockedPageGuard() {
  useEffect(() => {
    let leavingForOfficialSite = false
    let restoring = false

    const restoreBlockedPage = () => {
      if (leavingForOfficialSite || restoring) return
      restoring = true
      window.location.replace(window.location.href)
    }

    const handleInteraction = (event: Event) => {
      if (isAllowedTarget(event.target)) {
        if (event.type === 'click' || event.type === 'auxclick') leavingForOfficialSite = true
        return
      }
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const handleFocus = (event: FocusEvent) => {
      if (isAllowedTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      document.querySelector<HTMLElement>(ALLOWED_INTERACTION_SELECTOR)?.focus()
    }

    for (const type of BLOCKED_EVENTS) {
      document.addEventListener(type, handleInteraction, true)
    }
    document.addEventListener('focusin', handleFocus, true)

    const observer = new MutationObserver(() => {
      if (!document.querySelector(BLOCKED_SCREEN_SELECTOR)) restoreBlockedPage()
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })

    if (!document.querySelector(BLOCKED_SCREEN_SELECTOR)) restoreBlockedPage()

    return () => {
      observer.disconnect()
      for (const type of BLOCKED_EVENTS) {
        document.removeEventListener(type, handleInteraction, true)
      }
      document.removeEventListener('focusin', handleFocus, true)
    }
  }, [])
}
