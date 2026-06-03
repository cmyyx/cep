import { routing } from '@/i18n/routing'
import { DEFAULT_SITE_URL } from '@/lib/constants'

/**
 * Generate alternates (canonical + hreflang) for a page.
 *
 * Produces <link rel="canonical"> and <link rel="alternate" hreflang="...">
 * tags for every configured locale. The path segment is the route-specific
 * portion after /[locale] (e.g. "essence-planner", "" for home).
 */
export function getAlternates(
  locale: string,
  path: string = '',
): { canonical: string; languages: Record<string, string> } {
  const siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL
  const segments = path ? `/${path}` : ''

  const languages: Record<string, string> = {}
  for (const loc of routing.locales) {
    languages[loc] = `${siteUrl}/${loc}${segments}`
  }

  return {
    canonical: `${siteUrl}/${locale}${segments}`,
    languages,
  }
}
