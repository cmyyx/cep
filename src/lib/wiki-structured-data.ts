import { DEFAULT_SITE_URL } from '@/lib/constants'

/**
 * JSON-LD builders for the wiki routes.
 *
 * Why a separate pure module: the shapes are asserted by unit tests without a
 * DOM, and both the list pages and the detail pages need the same breadcrumb
 * chain. Everything here returns plain objects — rendering happens in
 * `<JsonLd>` (src/components/shared/json-ld.tsx).
 *
 * URLs must be absolute: crawlers do not resolve relative `item` URLs in an
 * `ItemList`, and a relative breadcrumb is dropped by Google.
 */

/** How many entities one `ItemList` may carry. Keeps the inlined JSON small;
 *  the list page itself still renders every entity and stays crawlable. */
export const ITEM_LIST_LIMIT = 100

export interface LdListItem {
  name: string
  url: string
}

export interface BreadcrumbEntry {
  name: string
  url: string
}

/** Absolute URL of one route, e.g. https://end.canmoe.com/zh-CN/wiki/characters */
export function pageUrl(locale: string, path = ''): string {
  return path ? `${DEFAULT_SITE_URL}/${locale}/${path}` : `${DEFAULT_SITE_URL}/${locale}`
}

/** Absolute URL of a public asset, e.g. /images/characters/chr_x.avif → https://... */
export function assetUrl(path: string): string {
  return `${DEFAULT_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function websiteNode(siteName: string, locale: string): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    name: siteName,
    url: pageUrl(locale),
  }
}

function breadcrumbNode(entries: BreadcrumbEntry[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.url,
    })),
  }
}

export interface CollectionPageLdInput {
  locale: string
  siteName: string
  /** Localized page title (the same string that ends up in <title>). */
  name: string
  description: string
  /** Route portion after the locale, e.g. "wiki/characters". */
  path: string
  items: LdListItem[]
  breadcrumbs: BreadcrumbEntry[]
}

/**
 * List / hub pages: a `CollectionPage` whose `mainEntity` is an `ItemList`,
 * plus the breadcrumb chain. Both nodes share one `@graph` so the page emits a
 * single <script> tag.
 */
export function buildCollectionPageLd({
  locale,
  siteName,
  name,
  description,
  path,
  items,
  breadcrumbs,
}: CollectionPageLdInput): Record<string, unknown> {
  const url = pageUrl(locale, path)
  // numberOfItems 只报真正写进 itemListElement 的条目，避免与列表长度不一致。
  const listed = items.slice(0, ITEM_LIST_LIMIT)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name,
        description,
        url,
        inLanguage: locale,
        isPartOf: websiteNode(siteName, locale),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: listed.length,
          itemListElement: listed.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            url: item.url,
          })),
        },
      },
      breadcrumbNode(breadcrumbs),
    ],
  }
}

export interface DetailPageLdInput {
  locale: string
  siteName: string
  /** Localized entity name. */
  name: string
  description: string
  /** Absolute URL of the detail page. */
  url: string
  /** Absolute image URL; omitted when the entity has no artwork. */
  image?: string
  breadcrumbs: BreadcrumbEntry[]
}

/**
 * Detail pages: a `WebPage` about one entity plus the breadcrumb chain.
 *
 * `WebPage` (not `Article`) on purpose — these are structured data records, not
 * editorial pieces, and Google's Article rich result would demand author and
 * publish dates the wiki does not have. The breadcrumb is what actually shows
 * up in the result.
 */
export function buildDetailPageLd({
  locale,
  siteName,
  name,
  description,
  url,
  image,
  breadcrumbs,
}: DetailPageLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name,
        description,
        url,
        inLanguage: locale,
        isPartOf: websiteNode(siteName, locale),
        about: { '@type': 'Thing', name },
        ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: image } } : {}),
      },
      breadcrumbNode(breadcrumbs),
    ],
  }
}

/** Breadcrumb chain for a wiki sub-index page: 首页 → <对应分类>. */
export function wikiListBreadcrumbs(
  locale: string,
  homeLabel: string,
  listLabel: string,
  path: string,
): BreadcrumbEntry[] {
  return [
    { name: homeLabel, url: pageUrl(locale) },
    { name: listLabel, url: pageUrl(locale, path) },
  ]
}
