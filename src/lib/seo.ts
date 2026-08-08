/**
 * Build-time SEO mode.
 *
 * Production deployment opts into indexing explicitly. Local and preview builds
 * stay noindex by default so a missing deployment variable cannot expose a
 * preview site to search engines.
 */
export function isSeoIndexableValue(value: string | undefined): boolean {
  return value === 'true'
}

export const SEO_INDEXABLE_BUILD = isSeoIndexableValue(process.env.SEO_INDEXABLE)
