/**
 * Shared locale detection utilities.
 * Used by LanguageSwitcher, LocaleGuard, root page redirect, and 404 page.
 */

const SUPPORTED = ['zh-CN', 'zh-TW', 'ja', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED)[number]
const DEFAULT: SupportedLocale = 'zh-CN'

const ZH_VARIANT_MAP: Record<string, SupportedLocale> = {
  'zh-hans': 'zh-CN',
  'zh-hant': 'zh-TW',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  'zh-hk': 'zh-TW',
  'zh-mo': 'zh-TW',
}

/**
 * Detect the best-matching supported locale from `navigator.language`.
 *
 * Matching priority:
 *   1. Exact match (case-insensitive): "ja" → "ja"
 *   2. Chinese variant table: "zh-Hans" → "zh-CN", "zh-Hant" → "zh-TW"
 *   3. Prefix match: "en-US" → "en"
 *   4. Default: "zh-CN"
 */
export function detectBrowserLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT
  const nav = navigator.language

  // Exact match (case-insensitive)
  const exact = SUPPORTED.find(
    (l) => l.toLowerCase() === nav.toLowerCase(),
  )
  if (exact) return exact

  // Chinese variant lookup (by full tag or by prefix)
  const lower = nav.toLowerCase()
  if (lower.startsWith('zh')) {
    // Try full tag first: "zh-Hans", "zh-Hant", "zh-CN", "zh-TW", "zh-HK"
    for (const [key, val] of Object.entries(ZH_VARIANT_MAP)) {
      if (lower.startsWith(key)) return val
    }
    // Bare "zh" or unknown variant → default
    return DEFAULT
  }

  // Non-Chinese prefix match: "en-US" → "en"
  const prefix = nav.split('-')[0]
  const match = SUPPORTED.find((l) => l.split('-')[0] === prefix)
  return match ?? DEFAULT
}

/**
 * Read the user's explicit language preference from localStorage.
 * Returns `null` when set to 'auto' or not present.
 * Bypasses Zustand hydration timing.
 */
export function getExplicitLanguage(): SupportedLocale | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('cep-settings')
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'language' in parsed) {
        const lang = (parsed as Record<string, unknown>).language
        if (
          typeof lang === 'string' &&
          lang !== 'auto' &&
          (SUPPORTED as readonly string[]).includes(lang)
        ) {
          return lang as SupportedLocale
        }
      }
    }
  } catch {
    /* ignore corrupt data */
  }
  return null
}

/**
 * Build a URL for the given locale, preserving the current path, query, and hash.
 * Uses `window.location.pathname` directly (not `usePathname()`) to guarantee
 * the locale prefix is included, regardless of next-intl configuration.
 *
 * Also handles case-insensitive locale matching for platforms that lowercase URLs.
 */
export function buildLocaleHref(targetLocale: SupportedLocale): string {
  const pathname = window.location.pathname
  const segments = pathname.split('/')

  // Find and replace the locale segment (first non-empty segment)
  if (segments.length > 1 && segments[1]) {
    segments[1] = targetLocale
  } else {
    // pathname is "/" — insert locale
    segments.splice(1, 0, targetLocale)
  }

  return (
    window.location.origin +
    segments.join('/') +
    window.location.search +
    window.location.hash
  )
}
