'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/useSettingsStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = (resolved: 'light' | 'dark' | 'flashbang') => {
      root.classList.remove('light', 'dark', 'flashbang')
      root.classList.add(resolved)

      if (resolved === 'flashbang') {
        root.style.colorScheme = 'dark'
        root.setAttribute('data-theme', 'flashbang')
      } else {
        root.style.colorScheme = resolved
        root.removeAttribute('data-theme')
      }
    }

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        applyTheme(e.matches ? 'dark' : 'light')
      }
      handler(mq)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    applyTheme(theme)
  }, [theme])

  return children
}
