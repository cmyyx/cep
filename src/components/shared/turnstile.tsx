'use client'

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, opts: TurnstileOptions) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

interface TurnstileOptions {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
  callback?: (token: string) => void
  'expired-callback'?: () => void
}

export type TurnstileStatus = 'loading' | 'ready'

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  onStateChange?: (status: TurnstileStatus) => void
  loadingText?: string
}

export interface TurnstileHandle {
  reset: () => void
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile(
  { siteKey, onVerify, onExpire, onStateChange, loadingText },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string>('')
  const rendered = useRef(false)
  const [status, setStatus] = useState<TurnstileStatus>('loading')

  // Keep onStateChange ref stable to avoid re-running effect
  const onStateChangeRef = useRef(onStateChange)
  onStateChangeRef.current = onStateChange

  // Expose reset to parent
  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current)
      }
      onExpireRef.current?.()
    },
  }), [])

  // Keep callback refs stable so the widget doesn't re-mount on prop changes
  const onVerifyRef = useRef(onVerify)
  onVerifyRef.current = onVerify
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    const container = containerRef.current
    if (!container || rendered.current) return

    function doRender() {
      if (!window.turnstile || rendered.current || !containerRef.current) return
      rendered.current = true

      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        size: 'normal',
        callback: (token: string) => {
          onVerifyRef.current(token)
        },
        'expired-callback': () => {
          onExpireRef.current?.()
          // Reset widget so user can retry
          if (widgetId.current && window.turnstile) {
            window.turnstile.reset(widgetId.current)
          }
        },
      })
      setStatus('ready')
      onStateChangeRef.current?.('ready')
    }

    // If Turnstile already loaded, render immediately
    if (window.turnstile) {
      doRender()
      return
    }

    // Load the script
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    )
    if (existing) {
      if (window.turnstile) {
        doRender()
      } else {
        existing.addEventListener('load', doRender, { once: true })
      }
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = doRender
    document.head.appendChild(script)

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = ''
        rendered.current = false
      }
    }
  }, [siteKey]) // Only re-render if siteKey changes (never)

  return (
    <>
      <div ref={containerRef} className={cn(status === 'loading' && 'hidden')} />
      {status === 'loading' && (
        <div
          className="w-[300px] h-[65px] flex items-center justify-center gap-2 rounded-md bg-muted/40"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          {loadingText && (
            <span className="text-sm text-muted-foreground">{loadingText}</span>
          )}
        </div>
      )}
    </>
  )
})
