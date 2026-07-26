'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { useSettingsStore } from '@/stores/useSettingsStore'
import {
  detectBrowserLocale,
  buildLocaleHref,
  type SupportedLocale,
} from '@/lib/locale-utils'

/** Explicit locale options, in display order. */
export const LANGUAGE_OPTIONS = ['zh-CN', 'zh-TW', 'ja', 'en'] as const

/**
 * Native-script language labels, shared by the sidebar LanguageSwitcher
 * and the settings page. Labels are intentionally NOT translated: each
 * language is always shown in its own script.
 */
export const LANGUAGE_NATIVE_LABELS: Record<SupportedLocale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  en: 'English',
}

/** Resolve the native label for an arbitrary locale string (falls back to the input). */
export function getLanguageNativeLabel(locale: string): string {
  return (LANGUAGE_NATIVE_LABELS as Record<string, string>)[locale] ?? locale
}

/**
 * Shared language-switch logic: persists the preference to the settings
 * store and performs a full-page jump to the same path under the target
 * locale. 'auto' resolves the browser locale first; navigation is skipped
 * when the target locale already matches the URL locale.
 */
export function useLanguageSwitch() {
  const urlLocale = useLocale()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)

  const switchLanguage = useCallback(
    (value: string | null) => {
      if (!value) return
      if (value === 'auto') {
        setLanguage('auto')
        const detected = detectBrowserLocale()
        if (detected !== urlLocale) {
          window.location.href = buildLocaleHref(detected)
        }
        return
      }
      if (!(LANGUAGE_OPTIONS as readonly string[]).includes(value)) return
      const next = value as SupportedLocale
      setLanguage(next)
      if (next !== urlLocale) {
        window.location.href = buildLocaleHref(next)
      }
    },
    [urlLocale, setLanguage],
  )

  return { urlLocale, language, switchLanguage }
}
