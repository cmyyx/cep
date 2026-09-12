/**
 * Runtime guard for missing game catalog translations.
 * Deduplicates notifications within a browser session and notifies listeners / Sentry.
 */
import * as Sentry from '@sentry/react'

export interface MissingTranslationEvent {
  key: string
  locale: string
  category?: string
  timestamp: number
}

type MissingTranslationListener = (event: MissingTranslationEvent) => void

const reportedKeys = new Set<string>()
const listeners = new Set<MissingTranslationListener>()

export function reportMissingTranslation({
  key,
  locale,
  category,
}: {
  key: string
  locale: string
  category?: string
}): void {
  if (typeof window === 'undefined') return
  const sessionKey = `${locale}:${key}`
  if (reportedKeys.has(sessionKey)) return
  reportedKeys.add(sessionKey)

  const event: MissingTranslationEvent = {
    key,
    locale,
    category,
    timestamp: Date.now(),
  }

  // Report to Sentry if initialized
  try {
    Sentry.captureMessage(`[Game i18n Missing] key: "${key}" in locale: "${locale}"`, {
      level: 'warning',
      tags: {
        i18nLocale: locale,
        i18nKey: key,
        i18nCategory: category ?? 'unknown',
      },
      extra: {
        pathname: window.location.pathname,
        href: window.location.href,
      },
    })
  } catch {
    // Ignore if Sentry is not available
  }

  // Notify UI subscribers
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // Ignore listener errors
    }
  }
}

export function onMissingTranslation(listener: MissingTranslationListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetMissingTranslationsForTests(): void {
  reportedKeys.clear()
  listeners.clear()
}
