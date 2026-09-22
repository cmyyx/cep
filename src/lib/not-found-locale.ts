import type { WikiLocale } from '@/types/wiki'

/**
 * Locale plumbing for the static 404 page — no message catalogs.
 *
 * Split out of `not-found-copy.ts` on purpose: this module is imported by
 * `app/layout.tsx`, so anything it imports lands in the critical path of every
 * page. `not-found-copy.ts` pulls all four messages/*.json (240 KB) to build
 * the 404 panel copy; that must stay reachable only from the 404 route.
 */

export const NOT_FOUND_LOCALES = ['zh-CN', 'zh-TW', 'ja', 'en'] as const satisfies readonly WikiLocale[]

export const DEFAULT_LOCALE: WikiLocale = 'zh-CN'

/**
 * Set the locale marker before the static 404 body is parsed. A missing or
 * unrecognised path segment falls back to zh-CN; the client page separately
 * redirects non-locale paths to the preferred locale.
 */
export function buildNotFoundLocaleScript(): string {
  return (
    '(function(){' +
    'try{' +
    `var L=${JSON.stringify(NOT_FOUND_LOCALES)},` +
    "s=location.pathname.split('/')[1]||''," +
    'l=L.find(function(x){return x.toLowerCase()===s.toLowerCase()})||' + JSON.stringify(DEFAULT_LOCALE) + ';' +
    "document.documentElement.setAttribute('data-notfound-lang',l);" +
    'document.documentElement.lang=l' +
    '}catch(e){}}())'
  )
}
