import { routing } from '@/i18n/routing'
import { DEFAULT_SITE_URL } from '@/lib/constants'

/**
 * Generate alternates (canonical + hreflang) for a page.
 *
 * Produces <link rel="canonical"> and <link rel="alternate" hreflang="...">
 * tags for every configured locale, plus an `x-default` entry pointing to the
 * default locale. The path segment is the route-specific portion after
 * /[locale] (e.g. "essence-planner", "" for home).
 */
export function getAlternates(
  locale: string,
  path: string = '',
): { canonical: string; languages: Record<string, string> } {
  const siteUrl = DEFAULT_SITE_URL
  const segments = path ? `/${path}` : ''

  const languages: Record<string, string> = {}
  for (const loc of routing.locales) {
    languages[loc] = `${siteUrl}/${loc}${segments}`
  }
  languages['x-default'] = `${siteUrl}/${routing.defaultLocale}${segments}`

  return {
    canonical: `${siteUrl}/${locale}${segments}`,
    languages,
  }
}

/**
 * 把翻译文件里的逗号分隔关键词串切成 <meta name="keywords"> 用的数组。
 * 中文关键词本身不含逗号，所以按半角逗号切分是安全的；空段与首尾空白都丢掉。
 */
export function parseKeywords(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
}
