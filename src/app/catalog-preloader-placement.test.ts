import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Placement guard for the game i18n catalog preloader.
 *
 * The per-locale catalog is ~958 KB raw / 113 KB gzip. Mounting it in
 * `[locale]/layout.tsx` made every route pay for it, including home, legal and
 * settings which never read it (measured: removing it halved DCL on Slow 4G).
 *
 * It now lives in the five route layouts whose pages actually consume the
 * catalog. This test pins that placement: re-adding it to the locale layout
 * silently undoes the win, and dropping it from a route layout reintroduces the
 * raw-id flash those routes were tuned to avoid.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const LOCALE_DIR = path.resolve(here, '[locale]')

/** Routes whose components read the catalog (computed from the import graph). */
const ROUTES_REQUIRING_CATALOG = [
  'essence-planner',
  'growth-planner',
  'panel-preview',
  'refinement-planner',
  'wiki',
] as const

const read = (relative: string) => readFileSync(path.join(LOCALE_DIR, relative), 'utf-8')

describe('game i18n catalog preloader placement', () => {
  it('is not mounted in the locale layout (every route would pay for it)', () => {
    const source = read('layout.tsx')
    expect(source).not.toContain('GameI18nCatalogPreloader')
  })

  it.each(ROUTES_REQUIRING_CATALOG)('is mounted in the %s layout', (route) => {
    const source = read(path.join(route, 'layout.tsx'))
    expect(source).toContain("import { GameI18nCatalogPreloader }")
    expect(source).toContain('<GameI18nCatalogPreloader locale={locale} />')
  })

  it('passes the route locale through to the preloader', () => {
    for (const route of ROUTES_REQUIRING_CATALOG) {
      const source = read(path.join(route, 'layout.tsx'))
      // The layouts destructure `const { locale } = await params`; the preloader
      // must use that value, not a hardcoded or default locale.
      expect(source, route).toContain('const { locale } = await params')
    }
  })
})
