'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCssInjectionStore } from '@/stores/useCssInjectionStore'

const CANARY_SELECTOR = '[data-cep-canary]'

export const COLOR_EXPECTED: Record<string, string> = {
  light: 'rgb(23, 23, 23)',
  dark: 'rgb(250, 250, 250)',
  flashbang: 'rgb(0, 0, 0)',
}

export function getTheme(): string {
  const cl = document.documentElement.classList
  if (cl.contains('flashbang')) return 'flashbang'
  if (cl.contains('dark')) return 'dark'
  return 'light'
}

export function checkCanary(): boolean {
  const el = document.querySelector(CANARY_SELECTOR)
  if (!el) return false
  const cs = getComputedStyle(el)

  // Focus on properties unlikely to be modified by user browser preferences.
  // fontSize and padding are intentionally omitted — they can false-positive
  // with non-default browser font settings or UA differences.
  if (cs.display !== 'flex') return true
  if (cs.color !== COLOR_EXPECTED[getTheme()]) return true

  return false
}

export function ExtensionCssDetector() {
  const t = useTranslations()
  const [visible, setVisible] = useState(false)
  const setDetected = useCssInjectionStore((s) => s.setDetected)
  const detectedRef = useRef(false)

  const report = useCallback(() => {
    if (detectedRef.current) return
    detectedRef.current = true
    console.warn('[CSS Injection] External style tampering detected')
    setDetected()
    setVisible(true)
  }, [setDetected])

  useEffect(() => {
    function scheduleCheck() {
      requestAnimationFrame(() => {
        if (checkCanary()) report()
      })
    }

    function handleMutation(mutations: MutationRecord[]) {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue
            const el = node as Element
            const tag = el.tagName
            if (tag === 'STYLE') { scheduleCheck(); return }
            if (tag === 'LINK' && el.getAttribute('rel') === 'stylesheet') {
              scheduleCheck(); return
            }
            if (el.querySelector?.('style, link[rel="stylesheet"]')) {
              scheduleCheck(); return
            }
          }
        } else if (mutation.type === 'attributes' || mutation.type === 'characterData') {
          // Attribute changes on <link> (href, media, disabled) or text changes in <style>
          scheduleCheck()
          return
        }
      }
    }

    // Initial check on load
    if (document.readyState === 'complete') {
      scheduleCheck()
    } else {
      window.addEventListener('load', scheduleCheck, { once: true })
    }

    // Watch for CSS injections (<style> / <link> additions) and modifications
    const cssObserver = new MutationObserver(handleMutation)
    cssObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'media', 'disabled'],
      characterData: true,
    })

    // Watch for theme class changes on <html>
    const themeObserver = new MutationObserver(scheduleCheck)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cssObserver.disconnect()
      themeObserver.disconnect()
    }
  }, [report])

  return (
    <>
      {/* Canary — hidden element with known Tailwind classes for style tampering detection */}
      <div
        data-cep-canary
        className="absolute invisible pointer-events-none h-0 overflow-hidden flex text-sm p-4 font-sans text-foreground"
      />
      {visible && (
        <div
          data-testid="extension-css-banner"
          className={cn(
            'flex items-start gap-2.5 px-4 py-2.5 shadow-[0px_1px_0px_0px_rgba(0,0,0,0.06)] shrink-0',
            'bg-amber-50/60 dark:bg-amber-950/60 text-sm text-amber-800 dark:text-amber-200'
          )}
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-medium leading-relaxed">{t('extensionCss.title')}</p>
            <p className="leading-relaxed opacity-80">{t('extensionCss.description')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 -mr-1 text-amber-500 hover:text-amber-700 hover:bg-amber-100/60"
            onClick={() => setVisible(false)}
            aria-label={t('common.close')}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
    </>
  )
}
