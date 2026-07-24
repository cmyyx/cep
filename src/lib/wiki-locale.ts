import type { WikiLocale } from '@/types/wiki'

/** Normalize next-intl locale strings to project WikiLocale (fallback zh-CN). */
export function asWikiLocale(locale: string): WikiLocale {
  if (locale === 'en' || locale === 'ja' || locale === 'zh-CN' || locale === 'zh-TW') {
    return locale
  }
  return 'zh-CN'
}
