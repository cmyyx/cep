import type { LocalizedText, WikiLocale } from '@/types/wiki'
import { asWikiLocale } from '@/lib/wiki-locale'

const WIKI_LOCALES = ['zh-CN', 'en', 'ja', 'zh-TW'] as const satisfies readonly WikiLocale[]

export function isLocalizedText(value: unknown): value is LocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return false
  if (!keys.every((key) => (WIKI_LOCALES as readonly string[]).includes(key))) return false
  return keys.every((key) => typeof obj[key] === 'string')
}

/** Pick current-locale string from a multi-locale map (fallback zh-CN → any → empty). */
export function localizeText(value: LocalizedText | string | undefined | null, locale: string): string {
  if (typeof value === 'string') return value
  if (!value) return ''
  const wikiLocale = asWikiLocale(locale)
  return value[wikiLocale] || value['zh-CN'] || value.en || value.ja || value['zh-TW'] || ''
}

/**
 * Deep-clone wiki detail/summary trees, collapsing every LocalizedText map to the
 * current-locale string so static export HTML/RSC payloads do not embed the other 3 locales.
 */
export function toLocaleDetail<T>(value: T, locale: string): LocalizeDeep<T> {
  return localizeDeep(value, asWikiLocale(locale)) as LocalizeDeep<T>
}

function localizeDeep(value: unknown, locale: WikiLocale): unknown {
  if (value == null || typeof value !== 'object') return value
  if (isLocalizedText(value)) return localizeText(value, locale)
  if (Array.isArray(value)) return value.map((entry) => localizeDeep(entry, locale))
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = localizeDeep(entry, locale)
  }
  return out
}

/** Mapped type: every LocalizedText becomes string. */
export type LocalizeDeep<T> = T extends LocalizedText
  ? string
  : T extends ReadonlyArray<infer U>
    ? Array<LocalizeDeep<U>>
    : T extends object
      ? { [K in keyof T]: LocalizeDeep<T[K]> }
      : T
