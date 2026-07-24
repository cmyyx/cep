/**
 * Generated game i18n catalogs for client-side lookup.
 *
 * Long-form wiki text (wikiData) must NOT go through NextIntlClientProvider:
 * static export serializes provider messages into every page HTML/RSC payload.
 *
 * Catalogs are loaded per locale via dynamic import() so unused locales stay out
 * of the initial client bundle. Results are cached and frozen (read-only).
 *
 * Full catalogs remain available to the server via loadMessages() for SSG.
 */
import type { WikiLocale } from '@/types/wiki'

export type StringCatalog = Record<string, string>

export type GameI18nNamespace =
  | 'characters'
  | 'weapons'
  | 'equips'
  | 'equipStats'
  | 'wikiData'

export type GameI18nLocaleBundle = Record<GameI18nNamespace, StringCatalog>

const cache = new Map<WikiLocale, GameI18nLocaleBundle>()
const inflight = new Map<WikiLocale, Promise<GameI18nLocaleBundle>>()

function freezeBundle(bundle: GameI18nLocaleBundle): GameI18nLocaleBundle {
  for (const key of Object.keys(bundle) as GameI18nNamespace[]) {
    Object.freeze(bundle[key])
  }
  return Object.freeze(bundle)
}

function unwrapJsonModule(mod: { default: StringCatalog } | StringCatalog): StringCatalog {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default: StringCatalog }).default
  }
  return mod as StringCatalog
}

/**
 * Explicit switch so the bundler emits one async chunk group per locale
 * (not a single mega-chunk with all languages).
 */
async function importLocaleBundle(locale: WikiLocale): Promise<GameI18nLocaleBundle> {
  switch (locale) {
    case 'en': {
      const [characters, weapons, equips, equipStats, wikiData] = await Promise.all([
        import('@/generated/i18n/characters/en.json'),
        import('@/generated/i18n/weapons/en.json'),
        import('@/generated/i18n/equips/en.json'),
        import('@/generated/i18n/equipStats/en.json'),
        import('@/generated/i18n/wikiData/en.json'),
      ])
      return freezeBundle({
        characters: unwrapJsonModule(characters),
        weapons: unwrapJsonModule(weapons),
        equips: unwrapJsonModule(equips),
        equipStats: unwrapJsonModule(equipStats),
        wikiData: unwrapJsonModule(wikiData),
      })
    }
    case 'ja': {
      const [characters, weapons, equips, equipStats, wikiData] = await Promise.all([
        import('@/generated/i18n/characters/ja.json'),
        import('@/generated/i18n/weapons/ja.json'),
        import('@/generated/i18n/equips/ja.json'),
        import('@/generated/i18n/equipStats/ja.json'),
        import('@/generated/i18n/wikiData/ja.json'),
      ])
      return freezeBundle({
        characters: unwrapJsonModule(characters),
        weapons: unwrapJsonModule(weapons),
        equips: unwrapJsonModule(equips),
        equipStats: unwrapJsonModule(equipStats),
        wikiData: unwrapJsonModule(wikiData),
      })
    }
    case 'zh-TW': {
      const [characters, weapons, equips, equipStats, wikiData] = await Promise.all([
        import('@/generated/i18n/characters/zh-TW.json'),
        import('@/generated/i18n/weapons/zh-TW.json'),
        import('@/generated/i18n/equips/zh-TW.json'),
        import('@/generated/i18n/equipStats/zh-TW.json'),
        import('@/generated/i18n/wikiData/zh-TW.json'),
      ])
      return freezeBundle({
        characters: unwrapJsonModule(characters),
        weapons: unwrapJsonModule(weapons),
        equips: unwrapJsonModule(equips),
        equipStats: unwrapJsonModule(equipStats),
        wikiData: unwrapJsonModule(wikiData),
      })
    }
    case 'zh-CN':
    default: {
      const [characters, weapons, equips, equipStats, wikiData] = await Promise.all([
        import('@/generated/i18n/characters/zh-CN.json'),
        import('@/generated/i18n/weapons/zh-CN.json'),
        import('@/generated/i18n/equips/zh-CN.json'),
        import('@/generated/i18n/equipStats/zh-CN.json'),
        import('@/generated/i18n/wikiData/zh-CN.json'),
      ])
      return freezeBundle({
        characters: unwrapJsonModule(characters),
        weapons: unwrapJsonModule(weapons),
        equips: unwrapJsonModule(equips),
        equipStats: unwrapJsonModule(equipStats),
        wikiData: unwrapJsonModule(wikiData),
      })
    }
  }
}

/** Sync read of an already-loaded locale bundle (undefined until loaded). */
export function getCachedGameI18nLocale(locale: WikiLocale): GameI18nLocaleBundle | undefined {
  return cache.get(locale)
}

/** Load (or return cached) catalogs for one locale. Safe to call repeatedly. */
export function loadGameI18nLocale(locale: WikiLocale): Promise<GameI18nLocaleBundle> {
  const cached = cache.get(locale)
  if (cached) return Promise.resolve(cached)

  let pending = inflight.get(locale)
  if (!pending) {
    pending = importLocaleBundle(locale)
      .then((bundle) => {
        cache.set(locale, bundle)
        inflight.delete(locale)
        return bundle
      })
      .catch((error: unknown) => {
        inflight.delete(locale)
        throw error
      })
    inflight.set(locale, pending)
  }
  return pending
}

/**
 * Shared frozen catalog for locale/namespace when already loaded.
 * Returns empty object if locale not yet loaded (callers should prefer the hook).
 */
export function getGameI18nCatalog(
  locale: WikiLocale,
  namespace: GameI18nNamespace,
): StringCatalog {
  return cache.get(locale)?.[namespace] ?? Object.freeze({})
}

export function lookupGameI18n(
  locale: WikiLocale,
  namespace: GameI18nNamespace,
  key: string,
): string | undefined {
  const value = cache.get(locale)?.[namespace]?.[key]
  return typeof value === 'string' ? value : undefined
}

export function hasGameI18n(
  locale: WikiLocale,
  namespace: GameI18nNamespace,
  key: string,
): boolean {
  return typeof cache.get(locale)?.[namespace]?.[key] === 'string'
}

/** Test helper */
export function resetGameI18nCatalogCacheForTests(): void {
  cache.clear()
  inflight.clear()
}
